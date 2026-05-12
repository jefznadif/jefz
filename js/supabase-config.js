// ========== SUPABASE CONFIGURATION ==========
// Kredensial ini public anon key (aman untuk frontend)
// Data sensitif seperti PIN disimpan di database Supabase (tidak di frontend)

const SB_URL = 'https://cxlvnwbfdbymdoddjqwn.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4bHZud2JmZGJ5bWRvZGRqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDUwOTMsImV4cCI6MjA5MzQ4MTA5M30.9jGx6eY7qzvQzW65xD7gVOMP1YZQzKjULginFNwSV-k';

const sb = window.supabase.createClient(SB_URL, SB_KEY);

// Generate unique device ID
function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('device_id', id);
  }
  return id;
}

const DEVICE_ID = getDeviceId();

// Generate unique user ID untuk chat
function getUserId() {
  let uid = localStorage.getItem('uid');
  if (!uid) {
    uid = 'u_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('uid', uid);
  }
  return uid;
}

const USER_ID = getUserId();
