export function showLoading(msg = 'Loading...') {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.hidden = false;
    loading.textContent = msg;
  }
}

export function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.hidden = true;
}

export function showEmpty(msg) {
  const empty = document.getElementById('empty');
  if (empty) {
    empty.hidden = false;
    empty.textContent = msg;
  }
}
