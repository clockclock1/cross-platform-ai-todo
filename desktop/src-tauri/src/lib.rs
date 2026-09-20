use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoItem {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub completed: bool,
    pub priority: String,
    pub category: String,
    pub tags: Vec<String>,
    pub due_date: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiList<T> {
    success: bool,
    data: T,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginResponse {
    success: bool,
    token: String,
}

pub struct AppState {
    pub api_base: Mutex<String>,
    pub token: Mutex<Option<String>>,
}

fn client(state: &State<'_, AppState>) -> Result<(String, reqwest::Client), String> {
    let base = state.api_base.lock().map_err(|e| e.to_string())?.clone();
    Ok((base, reqwest::Client::new()))
}

fn auth_header(state: &State<'_, AppState>) -> Result<String, String> {
    state
        .token
        .lock()
        .map_err(|e| e.to_string())?
        .clone()
        .ok_or_else(|| "请先登录".to_string())
}

#[tauri::command]
async fn set_api_base(url: String, state: State<'_, AppState>) -> Result<(), String> {
    *state.api_base.lock().map_err(|e| e.to_string())? = url;
    Ok(())
}

#[tauri::command]
async fn login(email: String, password: String, state: State<'_, AppState>) -> Result<String, String> {
    let (base, client) = client(&state)?;
    let res = client
        .post(format!("{}/api/auth/login", base))
        .json(&serde_json::json!({
            "email": email,
            "password": password,
            "platform": "desktop-rust",
            "deviceName": "Rust Desktop",
            "clientVersion": "1.0.0"
        }))
        .send()
        .await
        .map_err(|e| format!("网络错误: {}", e))?;
    let body: LoginResponse = res.json().await.map_err(|e| format!("解析失败: {}", e))?;
    if !body.success {
        return Err("登录失败".into());
    }
    *state.token.lock().map_err(|e| e.to_string())? = Some(body.token.clone());
    Ok(body.token)
}

#[tauri::command]
async fn fetch_todos(state: State<'_, AppState>) -> Result<Vec<TodoItem>, String> {
    let (base, client) = client(&state)?;
    let token = auth_header(&state)?;
    let res = client
        .get(format!("{}/api/todos", base))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    let body: ApiList<Vec<serde_json::Value>> = res.json().await.map_err(|e| format!("解析失败: {}", e))?;
    let todos = body
        .data
        .into_iter()
        .filter_map(|v| {
            Some(TodoItem {
                id: v.get("id")?.as_str()?.to_string(),
                title: v.get("title")?.as_str()?.to_string(),
                description: v.get("description").and_then(|d| d.as_str()).map(String::from),
                completed: v.get("completed")?.as_bool()?,
                priority: v.get("priority")?.as_str()?.to_string(),
                category: v.get("category")?.as_str()?.to_string(),
                tags: v
                    .get("tags")
                    .and_then(|t| t.as_array())
                    .map(|arr| arr.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
                due_date: v.get("dueDate").and_then(|d| d.as_str()).map(String::from),
                created_at: v.get("createdAt")?.as_str()?.to_string(),
            })
        })
        .collect();
    Ok(todos)
}

#[tauri::command]
async fn toggle_todo(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let (base, client) = client(&state)?;
    let token = auth_header(&state)?;
    let res = client
        .patch(format!("{}/api/todos/{}/toggle", base, id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    Ok(res.status().is_success())
}

#[tauri::command]
async fn send_ai_command(prompt: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let (base, client) = client(&state)?;
    let token = auth_header(&state)?;
    let res = client
        .post(format!("{}/api/ai/todo-action", base))
        .header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({ "prompt": prompt }))
        .send()
        .await
        .map_err(|e| format!("AI 请求失败: {}", e))?;
    res.json().await.map_err(|e| format!("解析失败: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AppState {
            api_base: Mutex::new("http://127.0.0.1:3000".to_string()),
            token: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            set_api_base,
            login,
            fetch_todos,
            toggle_todo,
            send_ai_command
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动桌面端失败");
}
