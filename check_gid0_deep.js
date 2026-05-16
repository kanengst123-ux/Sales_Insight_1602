
async function checkGid0Deep() {
  const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vStdyv4mUaIdO-jPeUwBfxMxBZbCkbNEtk8VNhyrpiAInlNb7w3jli2jYtERyVPp94aWMeVuP4N0XNv/pub?gid=0&single=true&output=csv';
  try {
    const response = await fetch(url);
    const text = await response.text();
    const rows = text.split('\n');
    console.log('GID 0 Deep check:');
    for (let i = 0; i < Math.min(rows.length, 100); i++) {
        const r = rows[i];
        if (r.toLowerCase().includes('title')) {
            console.log(`Row ${i} contains "title": ${r.substring(0, 100)}`);
        }
    }
  } catch (e) {}
}
checkGid0Deep();
