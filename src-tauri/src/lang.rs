use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct LanguageState {
    pub current: Mutex<String>,
}

impl LanguageState {
    pub fn new() -> Self {
        Self {
            current: Mutex::new("en".to_string()),
        }
    }
}

fn get_translations() -> HashMap<&'static str, HashMap<&'static str, &'static str>> {
    let mut map: HashMap<&str, HashMap<&str, &str>> = HashMap::new();

    let mut en = HashMap::new();
    en.insert("app.title", "Ursa PDF Forms");
    map.insert("en", en);

    let mut de = HashMap::new();
    de.insert("app.title", "PDF-Formular-Designer");
    map.insert("de", de);

    map
}

fn translate(lang: &str, key: &str) -> String {
    let translations = get_translations();
    translations
        .get(lang)
        .and_then(|m| m.get(key))
        .or_else(|| translations.get("en").and_then(|m| m.get(key)))
        .unwrap_or(&"")
        .to_string()
}

#[tauri::command]
pub fn set_language(app: AppHandle, lang: String) {
    {
        let state = app.state::<LanguageState>();
        let mut current = state.current.lock().unwrap();
        *current = lang.clone();
    }

    if let Some(window) = app.get_webview_window("main") {
        let title = translate(&lang, "app.title");
        let _ = window.set_title(&title);
    }
}
