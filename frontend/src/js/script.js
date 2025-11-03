// helper: pilih elemen yang terlihat (support duplicate IDs di DOM)
function getVisible(selector) {
  const els = Array.from(document.querySelectorAll(selector));
  return els.find(el => el.offsetParent !== null) || els[0] || null;
}

// pasang event listener hanya jika elemen ada
const nextBtn = document.getElementById("next");
if (nextBtn) nextBtn.addEventListener('click', () => showPage("tugas"));

const backBtn = document.getElementById("back");
if (backBtn) backBtn.addEventListener('click', () => showPage("home"));

const spanBtn = document.getElementById("span");
if (spanBtn) spanBtn.addEventListener('click', tampilkanSpan);

// Fungsi untuk menampilkan halaman yang dipilih
function showPage(page) {
  let nama = getVisible('#nama')?.value ?? document.getElementById("nama")?.value;
  let nim = getVisible('#nim')?.value ?? document.getElementById("nim")?.value;
  if (!nama && !nim) {
    alert("Isi dulu itu nama sama NIM-nya");
    return;
  } else if (!nama) {
    alert("Lah iya, itu nama belum diisi tuh");
    return;
  } else if (!nim) {
    alert("Lah iya, itu NIM belum diisi tuh");
    return;
  }

  document.querySelectorAll(".halaman").forEach((div) => (div.style.display = "none"));
  const target = document.getElementById(page);
  if (target) target.style.display = "flex";
}

// Menampilkan input file sesuai pertemuan yang dipilih
function tampilkanSpan() {
  const pertemuanEl = getVisible('#pertemuanBerapa');
  const sampaiEl = getVisible('#sampai');
  const container = getVisible('#file-upload');

  const pertemuan = parseInt(pertemuanEl?.value);
  const sampai = parseInt(sampaiEl?.value);

  if (!container) return;

  container.innerHTML = ""; // reset isi span
  document.getElementById("filePage").style = "height: 500px";
  document.getElementById("filePageMB").style = "";

  if (!isNaN(pertemuan) && !isNaN(sampai)) {
    for (let i = pertemuan; i <= sampai; i++) {
      container.innerHTML += `
        <div class="bg-amber-100 border-box rounded-md flex items-center justify-center cursor-pointer hover:bg-amber-200">
            <label for="files${i}" class="text-xl p-4 w-full cursor-pointer">Upload file pertemuan ${i}</label>
            <input required id="files${i}" type="file" accept=".pdf" hidden>
        </div>
      `;
    }
    for (let i = pertemuan; i <= sampai; i++) {
      let input = document.getElementById(`files${i}`);
      let label = document.querySelector(`label[for=files${i}]`);
      if (!input || !label) continue;
      input.onchange = function () {
        const fileName = this.files[0]?.name;
        label.innerText = fileName ?? "Browse Files";
        // label.style = "background-color: green; border-radius: 6px;";
      };
    }
  } else {
    alert("Pilih pertemuan terlebih dahulu!");
    container.innerHTML = "Pilih pertemuan dulu";
  }
}

window.tampilkanSpan = tampilkanSpan;

export { getVisible };