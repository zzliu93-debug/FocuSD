use serde::Serialize;
use std::{
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use windows::{
    Media::Control::{
        GlobalSystemMediaTransportControlsSession as MediaSession,
        GlobalSystemMediaTransportControlsSessionManager as MediaSessionManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
    },
    Win32::{
        Media::Audio::Endpoints::IAudioMeterInformation,
        Media::Audio::{
            eCommunications, eConsole, eMultimedia, eRender, IMMDeviceEnumerator,
            MMDeviceEnumerator,
        },
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
        },
        UI::Input::KeyboardAndMouse::{
            keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_MEDIA_NEXT_TRACK,
            VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK,
        },
    },
};

const AUDIO_ACTIVE_THRESHOLD: f32 = 0.000015;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaState {
    available: bool,
    audio_active: bool,
    audio_peak: f32,
    playback_status: &'static str,
    updated_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AudioLevel {
    active: bool,
    peak: f32,
    updated_at: i64,
}

#[derive(Clone, Copy)]
pub(crate) enum MediaCommand {
    PlayPause,
    Next,
    Previous,
}

pub(crate) fn get_state() -> Result<MediaState, String> {
    on_media_thread(read_media_state)
}

pub(crate) fn get_audio_level() -> Result<AudioLevel, String> {
    on_media_thread(|| {
        let peak = read_system_audio_peak()?;
        Ok(AudioLevel {
            active: peak > AUDIO_ACTIVE_THRESHOLD,
            peak,
            updated_at: current_unix_millis(),
        })
    })
}

pub(crate) fn run_command(command: MediaCommand) -> Result<MediaState, String> {
    on_media_thread(move || {
        if let Ok(manager) = request_manager() {
            if let Ok(Some(session)) = target_session(&manager) {
                if run_session_command(&session, command).unwrap_or(false) {
                    thread::sleep(Duration::from_millis(40));
                    return read_media_state_from_manager(&manager);
                }
            }
        }

        send_media_key(command);
        thread::sleep(Duration::from_millis(80));
        read_media_state()
    })
}

fn on_media_thread<T, F>(operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    thread::spawn(move || {
        let initialize_result = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        initialize_result
            .ok()
            .map_err(|error| media_error("Failed to initialize the media COM thread", error))?;

        let result = operation();
        unsafe { CoUninitialize() };
        result
    })
    .join()
    .map_err(|_| "The Windows media control thread panicked.".to_string())?
}

fn request_manager() -> Result<MediaSessionManager, String> {
    let operation = MediaSessionManager::RequestAsync().map_err(|error| {
        media_error("Failed to request the Windows media session manager", error)
    })?;
    pollster::block_on(operation)
        .map_err(|error| media_error("Failed to open the Windows media session manager", error))
}

fn target_session(manager: &MediaSessionManager) -> Result<Option<MediaSession>, String> {
    let current_session = manager.GetCurrentSession().ok();

    if current_session.as_ref().is_some_and(is_playing) {
        return Ok(current_session);
    }

    let sessions = manager
        .GetSessions()
        .map_err(|error| media_error("Failed to enumerate Windows media sessions", error))?;
    let mut first_session = None;

    for index in 0..sessions
        .Size()
        .map_err(|error| media_error("Failed to count Windows media sessions", error))?
    {
        let session = sessions
            .GetAt(index)
            .map_err(|error| media_error("Failed to read a Windows media session", error))?;

        if first_session.is_none() {
            first_session = Some(session.clone());
        }

        if is_playing(&session) {
            return Ok(Some(session));
        }
    }

    Ok(current_session.or(first_session))
}

fn is_playing(session: &MediaSession) -> bool {
    session
        .GetPlaybackInfo()
        .and_then(|info| info.PlaybackStatus())
        .is_ok_and(|status| status == PlaybackStatus::Playing)
}

fn run_play_pause(session: &MediaSession) -> Result<bool, String> {
    let status = session
        .GetPlaybackInfo()
        .and_then(|info| info.PlaybackStatus())
        .map_err(|error| media_error("Failed to read the active media playback state", error))?;

    if status == PlaybackStatus::Playing {
        let operation = session
            .TryPauseAsync()
            .map_err(|error| media_error("Failed to request media pause", error))?;
        pollster::block_on(operation).map_err(|error| media_error("Failed to pause media", error))
    } else {
        let operation = session
            .TryPlayAsync()
            .map_err(|error| media_error("Failed to request media playback", error))?;
        pollster::block_on(operation).map_err(|error| media_error("Failed to play media", error))
    }
}

fn run_session_command(session: &MediaSession, command: MediaCommand) -> Result<bool, String> {
    match command {
        MediaCommand::PlayPause => run_play_pause(session),
        MediaCommand::Next => pollster::block_on(
            session
                .TrySkipNextAsync()
                .map_err(|error| media_error("Failed to request the next track", error))?,
        )
        .map_err(|error| media_error("Failed to change to the next track", error)),
        MediaCommand::Previous => pollster::block_on(
            session
                .TrySkipPreviousAsync()
                .map_err(|error| media_error("Failed to request the previous track", error))?,
        )
        .map_err(|error| media_error("Failed to change to the previous track", error)),
    }
}

fn send_media_key(command: MediaCommand) {
    let key: VIRTUAL_KEY = match command {
        MediaCommand::PlayPause => VK_MEDIA_PLAY_PAUSE,
        MediaCommand::Next => VK_MEDIA_NEXT_TRACK,
        MediaCommand::Previous => VK_MEDIA_PREV_TRACK,
    };
    let key_code = key.0 as u8;

    unsafe { keybd_event(key_code, 0, KEYBD_EVENT_FLAGS(0), 0) };
    thread::sleep(Duration::from_millis(80));
    unsafe { keybd_event(key_code, 0, KEYEVENTF_KEYUP, 0) };
}

fn read_media_state() -> Result<MediaState, String> {
    match request_manager() {
        Ok(manager) => read_media_state_from_manager(&manager),
        Err(_) => read_media_state_without_session(),
    }
}

fn read_media_state_from_manager(manager: &MediaSessionManager) -> Result<MediaState, String> {
    let audio_peak = read_system_audio_peak().unwrap_or(0.0);
    let audio_active = audio_peak > AUDIO_ACTIVE_THRESHOLD;
    let Some(session) = target_session(manager)? else {
        return read_media_state_without_session();
    };

    let playback_info = session
        .GetPlaybackInfo()
        .map_err(|error| media_error("Failed to read Windows media playback information", error))?;
    let playback_status = playback_info
        .PlaybackStatus()
        .map_err(|error| media_error("Failed to read Windows media playback status", error))?;
    let is_playing = playback_status == PlaybackStatus::Playing;

    Ok(MediaState {
        available: true,
        audio_active,
        audio_peak,
        playback_status: if is_playing { "playing" } else { "paused" },
        updated_at: current_unix_millis(),
    })
}

fn read_media_state_without_session() -> Result<MediaState, String> {
    let audio_peak = read_system_audio_peak().unwrap_or(0.0);
    let audio_active = audio_peak > AUDIO_ACTIVE_THRESHOLD;

    Ok(MediaState {
        available: false,
        audio_active,
        audio_peak,
        playback_status: if audio_active {
            "playing"
        } else {
            "unavailable"
        },
        updated_at: current_unix_millis(),
    })
}

fn read_system_audio_peak() -> Result<f32, String> {
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|error| {
                media_error("Failed to open the Windows audio device manager", error)
            })?;
        let mut peak = 0.0_f32;
        let mut found_meter = false;

        for role in [eMultimedia, eConsole, eCommunications] {
            if let Ok(device) = enumerator.GetDefaultAudioEndpoint(eRender, role) {
                if let Ok(meter) = device.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None) {
                    found_meter = true;
                    if let Ok(value) = meter.GetPeakValue() {
                        peak = peak.max(value);
                    }
                }
            }
        }

        if found_meter {
            Ok(peak.clamp(0.0, 1.0))
        } else {
            Err("No default Windows audio output was available.".to_string())
        }
    }
}

fn media_error(context: &str, error: windows::core::Error) -> String {
    format!("{context}: {error}")
}

fn current_unix_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}
