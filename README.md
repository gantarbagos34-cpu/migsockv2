# MIG Duel Kick 10 - Instant Dispatch

KICK ALL menjalankan hingga 10 WebSocket secara bersamaan. Setiap WebSocket mengirim target dalam burst sesuai pilihan Burst (1–10) tanpa menunggu respons API.

- Maksimal 10 WebSocket berjalan konkuren.
- Dispatch `room.kick` tidak menunggu ACK, `room.kick.queued`, atau `job.get`.
- Progress KICK ALL dihitung dari jumlah command yang berhasil dikirim melalui WebSocket (`dispatchedJobs`).
- `textdelay` hanya mengatur jeda antar-burst di dalam loop; tidak ada jeda tambahan antar-loop.
- Di dalam satu burst, target dikirim langsung berurutan tanpa delay buatan.
- Kegagalan transport WebSocket dicatat sebagai `send_failed`.
- Server bind ke `0.0.0.0` agar dapat menerima koneksi dari platform hosting seperti Bonto.
- Frontend menggunakan cache-busting `frontend.js?v=49`.

## Deployment

Server sekarang hanya menggunakan `app.py` (Python + aiohttp). `server.js` sudah tidak diperlukan. Jalankan dengan `python app.py` atau `npm start` jika environment menyediakan Python. Install dependency dengan `pip install -r requirements.txt`.

## Performance

- WebSocket progress state menggunakan lookup O(1) berdasarkan physical slot.
- Tidak ada `Array.find()` pada KICK ALL dispatch hot path.
- Tidak ada penantian ACK atau `job.get` untuk dispatch KICK.
- Progress UI diperbarui secara coalesced agar tidak membuat Promise-chain untuk setiap target.

Version 50: mempertegas dispatch Burst 1–10, menampilkan metadata burst pada progress, dan mencegah update progress tertunda menimpa status selesai. Perubahan lain dari v48 dipertahankan.


- Progress Target dihitung dari target yang benar-benar sudah didispatch oleh seluruh WebSocket, bukan dari pembagian global `dispatchedJobs`.
- Progress Burst mengikuti target yang sudah benar-benar terkirim pada burst tersebut.


## Fast Burst
Default KICK ALL settings use burst 10 and delay 0 ms. The server remains no-ACK/dispatch based and skips offline WebSocket slots.


## Auto Target Accuracy
Auto target dibatasi maksimal 10 nama; kandidat harus memiliki similarity minimal 0.55 terhadap username Troop, dengan ranking berbasis kesamaan karakter, urutan karakter, prefix, dan edit distance. Username Troop sendiri dikeluarkan dari target.
