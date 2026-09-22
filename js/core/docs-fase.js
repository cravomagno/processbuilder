/* ============================================================
   docs-fase.js — overlay único de documentação por fase. Cada
   fase tem um <template id="docs-fase-{id}"> próprio (toc +
   seções); este controlador só clona o template no slot,
   liga a navegação (toc) e alterna a visibilidade do app-shell.
   ============================================================ */
window.DocsFase = (function(){
  "use strict";

  var el = null;
  var origemAberta = null;

  function buildElRefs(){
    return {
      overlay: document.getElementById("docsFaseOverlay"),
      titulo: document.getElementById("docsFaseTitulo"),
      subtitulo: document.getElementById("docsFaseSubtitulo"),
      slot: document.getElementById("docsFaseSlot"),
      backBtn: document.getElementById("docsFaseBackBtn")
    };
  }

  function wireToc(container){
    var botoes = container.querySelectorAll(".docs-toc button");
    botoes.forEach(function(btn){
      btn.addEventListener("click", function(){
        botoes.forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        var alvo = container.querySelector("#" + btn.dataset.target);
        if(alvo) alvo.scrollIntoView({behavior:"smooth", block:"start"});
      });
    });
  }

  function abrir(faseId, tituloFase, subtitulo, origemEl){
    var tpl = document.getElementById("docs-fase-" + faseId);
    if(!tpl) return;
    el.slot.innerHTML = "";
    el.slot.appendChild(tpl.content.cloneNode(true));
    el.titulo.textContent = tituloFase || "Documentação";
    el.subtitulo.textContent = subtitulo || "";
    wireToc(el.slot);
    origemAberta = origemEl || document.querySelector(".app-shell");
    if(origemAberta) origemAberta.style.display = "none";
    el.overlay.style.display = "block";
    window.scrollTo(0, 0);
  }

  function fechar(){
    el.overlay.style.display = "none";
    if(origemAberta) origemAberta.style.display = "";
    origemAberta = null;
  }

  function init(){
    el = buildElRefs();
    if(!el.overlay) return;
    el.backBtn.addEventListener("click", fechar);
    document.querySelectorAll(".fase-docs-btn").forEach(function(btn){
      btn.addEventListener("click", function(){
        var faseId = btn.dataset.fase;
        var fase = window.CasoState.FASES_BACKBONE.filter(function(f){ return f.id === faseId; })[0];
        var titulo = fase ? ("Fase " + fase.ordem + " — " + fase.nome) : "Documentação";
        abrir(faseId, titulo, "Manual de uso das ferramentas desta fase");
      });
    });
  }

  return { init: init, abrir: abrir, fechar: fechar };
})();
