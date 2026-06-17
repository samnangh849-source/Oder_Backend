function keepRenderAwake() {
  try {
    // ហៅទៅកាន់ Route /ping ដែលទើបបង្កើតថ្មី
    UrlFetchApp.fetch(RENDER_BASE_URL + '/ping', { muteHttpExceptions: true });
  } catch (err) {
    // មិនបាច់ខ្វល់ពី Error បើវាមានបញ្ហាពេល Ping
  }
}

const RENDER_BASE_URL = 'https://oder-backend-2.onrender.com';



