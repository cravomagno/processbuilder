/* ============================================================
   toast.js — toast global do shell (distinto do toast interno do
   RaciModule, que só cobre mensagens da própria matriz RACI).
   ============================================================ */
window.AppToast = (function(){
  "use strict";
  var timer = null;

  function show(msg, isError){
    var el = document.getElementById("appToast");
    if(!el) return;
    el.textContent = msg;
    el.className = "toast show" + (isError ? " error" : "");
    clearTimeout(timer);
    timer = setTimeout(function(){ el.className = "toast"; }, 3200);
  }

  return { show: show };
})();
