const form = document.querySelector("#upload-form");
const fileInput = document.querySelector("#medicine-image");
const previewWrap = document.querySelector("#preview-wrap");
const previewImage = document.querySelector("#preview-image");
const submitButton = document.querySelector("#submit-button");
const statusBox = document.querySelector("#status");
const resultBox = document.querySelector("#result");

let imageDataUrl = "";

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    imageDataUrl = "";
    previewWrap.classList.add("hidden");
    return;
  }

  imageDataUrl = await readFileAsDataUrl(file);
  previewImage.src = imageDataUrl;
  previewWrap.classList.remove("hidden");
  statusBox.textContent =
    "Imagem pronta. Clique em analisar para gerar um resumo da bula.";
  resultBox.classList.add("hidden");
  resultBox.innerHTML = "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!imageDataUrl) {
    statusBox.textContent = "Selecione uma imagem antes de analisar.";
    return;
  }

  setLoadingState(true);
  statusBox.textContent =
    "Analisando a imagem e preparando um resumo seguro da bula...";
  resultBox.classList.add("hidden");
  resultBox.innerHTML = "";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: imageDataUrl })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Nao foi possivel analisar a imagem.");
    }

    resultBox.innerHTML = markdownToHtml(data.summary);
    resultBox.classList.remove("hidden");
    statusBox.textContent =
      "Resumo gerado. Confira com a bula oficial e com um profissional se houver qualquer duvida.";
  } catch (error) {
    statusBox.textContent = error.message;
  } finally {
    setLoadingState(false);
  }
});

function setLoadingState(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Analisando..." : "Analisar remedio";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown);
  const withHeadings = escaped.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  const paragraphs = withHeadings
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("<h2>")) {
        return block;
      }

      if (/^- /m.test(block)) {
        const items = block
          .split("\n")
          .filter((line) => line.startsWith("- "))
          .map((line) => `<li>${line.slice(2)}</li>`)
          .join("");

        return `<ul>${items}</ul>`;
      }

      return `<p>${block.replace(/\n/g, "<br />")}</p>`;
    })
    .join("");

  return paragraphs;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
