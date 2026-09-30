/* ============================================================
   beta-aviso.js — balão fixo avisando que o sistema está em
   beta-teste. Independente de caso-state.js/app.js de propósito:
   precisa aparecer em QUALQUER tela (landing sem caso, qualquer
   fase, telas de documentação/execução), então não pode depender
   do fluxo de carregamento do caso (que em app.js sai mais cedo,
   via wireLanding()+return, quando não há caso salvo).

   Comportamento: visível assim que a página carrega; ao fechar
   ("×"), some e reaparece sozinho 12 minutos depois — ciclo que se
   repete indefinidamente enquanto a aba ficar aberta. Não usa
   localStorage/sessionStorage: é estado só desta sessão de página,
   recomeça do zero (visível) a cada recarregamento.
   ============================================================ */
(function(){
  "use strict";

  var INTERVALO_MS = 12 * 60 * 1000; // 12 minutos
  var timer = null;
  var el = null;

  function mostrar(){
    if(el) el.hidden = false;
  }

  function esconder(){
    if(!el) return;
    el.hidden = true;
    clearTimeout(timer);
    timer = setTimeout(mostrar, INTERVALO_MS);
  }

  document.addEventListener("DOMContentLoaded", function(){
    el = document.getElementById("betaBalao");
    var fecharBtn = document.getElementById("betaBalaoFechar");
    if(!el || !fecharBtn) return;
    fecharBtn.addEventListener("click", esconder);
    mostrar();
  });
})();
