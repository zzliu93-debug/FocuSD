mod clipboard_history;

use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::{Mutex, OnceLock},
    thread,
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, LogicalSize, Manager, PhysicalPosition, Position, Size, WebviewWindow,
};
use windows::Win32::{
    Foundation::{POINT, RECT, RPC_E_CHANGED_MODE},
    Media::Audio::Endpoints::IAudioMeterInformation,
    Media::Audio::{
        eCommunications, eConsole, eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    },
    System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
    },
    UI::{
        Input::KeyboardAndMouse::{
            keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_MEDIA_NEXT_TRACK,
            VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK,
        },
        WindowsAndMessaging::{GetCursorPos, GetWindowRect},
    },
};

const WINDOW_LABEL: &str = "main";
const STAGE_WINDOW_WIDTH: f64 = 820.0;
const STAGE_WINDOW_HEIGHT: f64 = 460.0;
const DEFAULT_MARGIN_Y: f64 = 12.0;
const DEFAULT_SCALE: f64 = 1.0;
const COLLAPSED_ISLAND_WIDTH: f64 = 320.0;
const COLLAPSED_ISLAND_HEIGHT: f64 = 58.0;
const EXPANDED_ISLAND_WIDTH: f64 = 560.0;
const DEFAULT_EXPANDED_ISLAND_HEIGHT: f64 = 306.0;
const EXPANDED_ISLAND_HEIGHT_RANGE: f64 = 240.0;
const EXPANDED_RADIUS: f64 = 30.0;
const STAGE_WINDOW_PADDING_Y: f64 = 24.0;
const TUCKED_VISIBLE_EDGE_HEIGHT: f64 = 10.0;
const STARTUP_REGISTRY_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const STARTUP_REGISTRY_VALUE: &str = "FocuSD Island";
const AUDIO_ACTIVE_THRESHOLD: f32 = 0.000015;

static WINDOW_STATE: OnceLock<Mutex<IslandWindowState>> = OnceLock::new();

#[derive(Clone, Copy)]
enum IslandMode {
    Collapsed,
    Expanded,
}

impl IslandMode {
    fn from_value(value: &str) -> Result<Self, String> {
        match value {
            "collapsed" => Ok(Self::Collapsed),
            "expanded" => Ok(Self::Expanded),
            _ => Err(format!("Unsupported island mode: {value}")),
        }
    }

    fn base_size(self, expanded_height: f64) -> (f64, f64) {
        match self {
            Self::Collapsed => (COLLAPSED_ISLAND_WIDTH, COLLAPSED_ISLAND_HEIGHT),
            Self::Expanded => (EXPANDED_ISLAND_WIDTH, expanded_height),
        }
    }

    fn corner_radius(self) -> f64 {
        match self {
            Self::Collapsed => COLLAPSED_ISLAND_HEIGHT / 2.0,
            Self::Expanded => EXPANDED_RADIUS,
        }
    }
}

#[derive(Clone, Copy)]
struct IslandWindowState {
    mode: IslandMode,
    is_tucked: bool,
    size_scale: f64,
    margin_y: f64,
    expanded_height: f64,
}

impl Default for IslandWindowState {
    fn default() -> Self {
        Self {
            mode: IslandMode::Collapsed,
            is_tucked: false,
            size_scale: DEFAULT_SCALE,
            margin_y: DEFAULT_MARGIN_Y,
            expanded_height: DEFAULT_EXPANDED_ISLAND_HEIGHT,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IslandLayout {
    size_scale: f64,
    margin_y: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveTodoMarkdownResult {
    file_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaState {
    available: bool,
    audio_active: bool,
    audio_peak: f32,
    playback_status: String,
    updated_at: i64,
}

impl Default for MediaState {
    fn default() -> Self {
        Self {
            available: false,
            audio_active: false,
            audio_peak: 0.0,
            playback_status: "unavailable".to_string(),
            updated_at: current_unix_millis(),
        }
    }
}

#[tauri::command]
fn set_island_layout(app: AppHandle, layout: IslandLayout) -> Result<(), String> {
    let window = main_window(&app)?;
    let state = mutate_window_state(|state| {
        state.size_scale = layout.size_scale.clamp(0.75, 1.4);
        state.margin_y = layout.margin_y.clamp(0.0, 160.0);
        *state
    });
    apply_stage_geometry(&window, state)
}

#[tauri::command]
fn set_island_interaction(
    app: AppHandle,
    mode: String,
    size_scale: f64,
    expanded_height: Option<f64>,
    is_tucked: Option<bool>,
) -> Result<(), String> {
    let window = main_window(&app)?;
    let mode = IslandMode::from_value(&mode)?;
    let state = mutate_window_state(|state| {
        state.mode = mode;
        state.is_tucked = is_tucked.unwrap_or(false);
        state.size_scale = size_scale.clamp(0.75, 1.4);
        if let Some(expanded_height) = expanded_height {
            state.expanded_height = expanded_height.clamp(
                DEFAULT_EXPANDED_ISLAND_HEIGHT,
                DEFAULT_EXPANDED_ISLAND_HEIGHT + EXPANDED_ISLAND_HEIGHT_RANGE,
            );
        }
        *state
    });
    apply_stage_geometry(&window, state)
}

#[tauri::command]
fn minimize_island(app: AppHandle) -> Result<(), String> {
    hide_island(&app);
    Ok(())
}

#[tauri::command]
fn get_launch_at_startup() -> Result<bool, String> {
    let status = Command::new("reg")
        .args(["query", STARTUP_REGISTRY_KEY, "/v", STARTUP_REGISTRY_VALUE])
        .status()
        .map_err(|error| format!("Failed to query startup registry: {error}"))?;

    Ok(status.success())
}

#[tauri::command]
fn set_launch_at_startup(enabled: bool) -> Result<(), String> {
    let status = if enabled {
        let current_exe = std::env::current_exe()
            .map_err(|error| format!("Failed to resolve current executable: {error}"))?;
        let startup_value = format!("\"{}\"", current_exe.display());

        Command::new("reg")
            .args([
                "add",
                STARTUP_REGISTRY_KEY,
                "/v",
                STARTUP_REGISTRY_VALUE,
                "/t",
                "REG_SZ",
                "/d",
            ])
            .arg(startup_value)
            .arg("/f")
            .status()
    } else {
        Command::new("reg")
            .args([
                "delete",
                STARTUP_REGISTRY_KEY,
                "/v",
                STARTUP_REGISTRY_VALUE,
                "/f",
            ])
            .status()
    }
    .map_err(|error| format!("Failed to update startup registry: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err("Startup registry command failed.".to_string())
    }
}

#[tauri::command]
fn save_todo_markdown(
    directory: String,
    date: String,
    content: String,
) -> Result<SaveTodoMarkdownResult, String> {
    let directory = directory.trim();

    if directory.is_empty() {
        return Err("Todo save path is empty.".to_string());
    }

    if !date.chars().all(|ch| ch.is_ascii_digit() || ch == '-') {
        return Err("Todo date contains invalid filename characters.".to_string());
    }

    let directory_path = PathBuf::from(directory);
    fs::create_dir_all(&directory_path).map_err(|error| error.to_string())?;

    let file_path = directory_path.join(format!("{date}.md"));
    fs::write(&file_path, content).map_err(|error| error.to_string())?;

    Ok(SaveTodoMarkdownResult {
        file_path: file_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn get_media_state() -> MediaState {
    read_media_state()
}

#[tauri::command]
fn get_audio_level() -> AudioLevel {
    let peak = read_system_audio_peak_window(6, Duration::from_millis(8)).unwrap_or(0.0);

    AudioLevel {
        active: peak > AUDIO_ACTIVE_THRESHOLD,
        peak,
        updated_at: current_unix_millis(),
    }
}

#[tauri::command]
fn media_play_pause() {
    send_media_key(VK_MEDIA_PLAY_PAUSE);
}

#[tauri::command]
fn media_next() {
    send_media_key(VK_MEDIA_NEXT_TRACK);
}

#[tauri::command]
fn media_previous() {
    send_media_key(VK_MEDIA_PREV_TRACK);
}

fn read_media_state() -> MediaState {
    let audio_peak = read_system_audio_peak_window(3, Duration::from_millis(6)).unwrap_or(0.0);
    let audio_active = audio_peak > AUDIO_ACTIVE_THRESHOLD;

    MediaState {
        available: audio_active,
        audio_active,
        audio_peak,
        playback_status: if audio_active {
            "playing"
        } else {
            "unavailable"
        }
        .to_string(),
        updated_at: current_unix_millis(),
    }
}

fn read_system_audio_peak_window(samples: usize, delay: Duration) -> Result<f32, String> {
    unsafe {
        let did_initialize_com = initialize_com_for_audio();
        let peak_result = (|| {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(media_error)?;
            let mut meters: Vec<IAudioMeterInformation> = Vec::new();

            for role in [eMultimedia, eConsole, eCommunications] {
                if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, role) {
                    if let Ok(meter) = device.Activate(CLSCTX_ALL, None) {
                        meters.push(meter);
                    }
                }
            }

            if meters.is_empty() {
                return Err("No default render audio endpoint was available.".to_string());
            }

            let mut peak = 0.0_f32;

            for sample_index in 0..samples.max(1) {
                for meter in &meters {
                    if let Ok(value) = meter.GetPeakValue() {
                        peak = peak.max(value);
                    }
                }

                if !delay.is_zero() && sample_index + 1 < samples {
                    thread::sleep(delay);
                }
            }

            Ok(peak.clamp(0.0, 1.0))
        })();

        if did_initialize_com {
            CoUninitialize();
        }

        peak_result
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AudioLevel {
    active: bool,
    peak: f32,
    updated_at: i64,
}

fn initialize_com_for_audio() -> bool {
    unsafe {
        let result = CoInitializeEx(None, COINIT_MULTITHREADED);

        if result == RPC_E_CHANGED_MODE {
            false
        } else {
            result.is_ok()
        }
    }
}

fn send_media_key(key: VIRTUAL_KEY) {
    let key_code = key.0 as u8;

    unsafe {
        keybd_event(key_code, 0, KEYBD_EVENT_FLAGS(0), 0);
        thread::sleep(Duration::from_millis(18));
        keybd_event(key_code, 0, KEYEVENTF_KEYUP, 0);
    }
}

fn current_unix_millis() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn media_error(error: windows::core::Error) -> String {
    format!("Windows media session error: {error}")
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(WINDOW_LABEL)
        .ok_or_else(|| "Main island window was not found.".to_string())
}

fn show_island(app: &AppHandle) -> Result<(), String> {
    let window = main_window(app)?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

fn hide_island(app: &AppHandle) {
    if let Ok(window) = main_window(app) {
        let _ = window.hide();
    }
}

fn window_state() -> &'static Mutex<IslandWindowState> {
    WINDOW_STATE.get_or_init(|| Mutex::new(IslandWindowState::default()))
}

fn mutate_window_state(
    update: impl FnOnce(&mut IslandWindowState) -> IslandWindowState,
) -> IslandWindowState {
    let mut state = window_state().lock().expect("window state poisoned");
    update(&mut state)
}

fn read_window_state() -> IslandWindowState {
    *window_state().lock().expect("window state poisoned")
}

fn apply_stage_geometry(window: &WebviewWindow, state: IslandWindowState) -> Result<(), String> {
    let (_, base_height) = state.mode.base_size(state.expanded_height);
    let stage_height =
        STAGE_WINDOW_HEIGHT.max((base_height * state.size_scale).ceil() + STAGE_WINDOW_PADDING_Y);

    window
        .set_size(Size::Logical(LogicalSize::new(
            STAGE_WINDOW_WIDTH,
            stage_height,
        )))
        .map_err(|error| error.to_string())?;

    let monitor = window
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .or(window
            .current_monitor()
            .map_err(|error| error.to_string())?)
        .ok_or_else(|| "No monitor is available for island positioning.".to_string())?;

    let scale = monitor.scale_factor();
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let physical_width = (STAGE_WINDOW_WIDTH * scale).round() as i32;
    let physical_top_offset = if matches!(state.mode, IslandMode::Collapsed) && state.is_tucked {
        -((COLLAPSED_ISLAND_HEIGHT * state.size_scale - TUCKED_VISIBLE_EDGE_HEIGHT).max(0.0)
            * scale)
            .round() as i32
    } else {
        (state.margin_y * scale).round() as i32
    };
    let x = monitor_position.x + ((monitor_size.width as i32 - physical_width) / 2);
    let y = monitor_position.y + physical_top_offset;

    window
        .set_position(Position::Physical(PhysicalPosition::new(x, y)))
        .map_err(|error| error.to_string())
}

fn start_cursor_passthrough_loop(window: WebviewWindow) {
    thread::spawn(move || {
        let mut ignoring_cursor = false;

        loop {
            let should_ignore = !cursor_is_inside_island(&window);

            if should_ignore != ignoring_cursor {
                if window.set_ignore_cursor_events(should_ignore).is_ok() {
                    ignoring_cursor = should_ignore;
                }
            }

            thread::sleep(Duration::from_millis(12));
        }
    });
}

fn cursor_is_inside_island(window: &WebviewWindow) -> bool {
    let hwnd = match window.hwnd() {
        Ok(hwnd) => hwnd,
        Err(_) => return true,
    };
    let mut window_rect = RECT::default();
    let mut cursor = POINT::default();

    if unsafe { GetWindowRect(hwnd, &mut window_rect) }.is_err() {
        return true;
    }

    if unsafe { GetCursorPos(&mut cursor) }.is_err() {
        return true;
    }

    let window_width = (window_rect.right - window_rect.left).max(1) as f64;
    let physical_scale = window_width / STAGE_WINDOW_WIDTH;
    let local_x = (cursor.x - window_rect.left) as f64;
    let local_y = (cursor.y - window_rect.top) as f64;
    let state = read_window_state();
    let (base_width, base_height) = state.mode.base_size(state.expanded_height);
    let island_width = base_width * state.size_scale * physical_scale;
    let island_height = base_height * state.size_scale * physical_scale;
    let island_left = (window_width - island_width) / 2.0;
    let island_top = 0.0;
    let radius = state.mode.corner_radius() * state.size_scale * physical_scale;

    point_in_rounded_rect(
        local_x,
        local_y,
        island_left,
        island_top,
        island_width,
        island_height,
        radius,
    )
}

fn point_in_rounded_rect(
    x: f64,
    y: f64,
    left: f64,
    top: f64,
    width: f64,
    height: f64,
    radius: f64,
) -> bool {
    let right = left + width;
    let bottom = top + height;

    if x < left || x > right || y < top || y > bottom {
        return false;
    }

    let radius = radius.min(width / 2.0).min(height / 2.0);
    let center_x = if x < left + radius {
        left + radius
    } else if x > right - radius {
        right - radius
    } else {
        x
    };
    let center_y = if y < top + radius {
        top + radius
    } else if y > bottom - radius {
        bottom - radius
    } else {
        y
    };
    let dx = x - center_x;
    let dy = y - center_y;

    (dx * dx) + (dy * dy) <= radius * radius
}

fn build_tray(app: &App) -> tauri::Result<()> {
    let show_item = MenuItem::with_id(app, "show", "Show Island", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Hide Island", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

    let mut tray = TrayIconBuilder::new()
        .tooltip("FocuSD Island")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                let _ = show_island(app);
            }
            "hide" => hide_island(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let _ = show_island(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            build_tray(app)?;
            if let Err(error) = clipboard_history::init(app.handle()) {
                eprintln!("failed to initialize clipboard history: {error}");
            }
            if let Ok(window) = main_window(app.handle()) {
                if let Err(error) = apply_stage_geometry(&window, IslandWindowState::default()) {
                    eprintln!("failed to size and position island window: {error}");
                }
                start_cursor_passthrough_loop(window);
            }
            if let Err(error) = show_island(app.handle()) {
                eprintln!("failed to show island window: {error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_island_layout,
            set_island_interaction,
            save_todo_markdown,
            minimize_island,
            get_launch_at_startup,
            set_launch_at_startup,
            get_media_state,
            get_audio_level,
            media_play_pause,
            media_next,
            media_previous,
            clipboard_history::get_clipboard_history,
            clipboard_history::set_clipboard_history_settings,
            clipboard_history::copy_clipboard_history_item,
            clipboard_history::delete_clipboard_history_item,
            clipboard_history::clear_clipboard_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running FocuSD Island");
}
