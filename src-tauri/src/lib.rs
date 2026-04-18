use tauri::command;
use tauri::Manager;
use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;

#[command]
fn write_file(path: String, contents: Vec<u8>) -> Result<(), String> {
  std::fs::write(&path, &contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![write_file])
    .setup(|app| {
      let main = app.get_webview_window("main").unwrap();
      let pos = main.outer_position().unwrap();
      let size = main.outer_size().unwrap();

      let html = include_str!("titlebar.html");
      let data_url = format!("data:text/html,{}", urlencoding::encode(html));

      let _ = WebviewWindowBuilder::new(
        app,
        "titlebar",
        WebviewUrl::External(data_url.parse().unwrap())
      )
        .title("")
        .decorations(false)
        .resizable(false)
        .inner_size(size.width as f64, 34.0)
        .position(pos.x as f64, pos.y as f64)
        .always_on_top(true)
        .build();

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}