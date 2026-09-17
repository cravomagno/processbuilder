/* ============================================================
   nav.js — navegação entre as 7 fase-views (toggle generalizado
   do padrão toolView/docsView do v7, com N estados via data-fase).
   ============================================================ */
window.Nav = (function(){
  "use strict";

  function irParaFase(faseId){
    document.querySelectorAll(".fase-view").forEach(function(v){ v.classList.remove("active"); });
    document.querySelectorAll(".nav-tab").forEach(function(t){ t.classList.toggle("active", t.dataset.fase === faseId); });
    var view = document.getElementById("fase-view-" + faseId);
    if(view) view.classList.add("active");
    if(location.hash.slice(1) !== faseId) location.hash = faseId;
    window.scrollTo(0, 0);
  }

  function init(faseIdsValidos, faseIdPadrao){
    window.addEventListener("hashchange", function(){
      var alvo = location.hash.slice(1);
      irParaFase(faseIdsValidos.indexOf(alvo) !== -1 ? alvo : faseIdPadrao);
    });
    document.querySelectorAll(".nav-tab").forEach(function(tab){
      tab.addEventListener("click", function(){ irParaFase(tab.dataset.fase); });
    });
    var inicial = location.hash.slice(1);
    irParaFase(faseIdsValidos.indexOf(inicial) !== -1 ? inicial : faseIdPadrao);
  }

  return { irParaFase: irParaFase, init: init };
})();
