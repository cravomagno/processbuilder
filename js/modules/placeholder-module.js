/* ============================================================
   placeholder-module.js — módulo genérico de tarefas/entregáveis
   para fases que ainda não têm ferramenta auxiliar especializada
   (Ishikawa, 5W2H, GUT etc. entram aqui em iterações futuras).
   Diferente do RaciModule, é instanciado várias vezes (uma por
   fase sem ferramenta), então não usa estado de closure — cada
   mount() opera diretamente sobre o objeto `fase` recebido.
   ============================================================ */
window.PlaceholderModule = (function(){
  "use strict";

  function uid(){ return "item_" + Date.now() + "_" + Math.floor(Math.random()*10000); }

  function render(root, fase, onChange){
    var tarefasList = root.querySelector(".placeholder-tarefas");
    var entregaveisArea = root.querySelector(".placeholder-entregaveis-text");

    tarefasList.innerHTML = "";
    if(fase.tarefas.length === 0){
      var vazio = document.createElement("li");
      vazio.style.cssText = "font-size:12.5px;color:var(--ink-faint);background:transparent;padding:2px 4px;";
      vazio.textContent = "Nenhuma tarefa ainda.";
      tarefasList.appendChild(vazio);
    }
    fase.tarefas.forEach(function(t){
      var li = document.createElement("li");
      li.className = t.feito ? "feito" : "";

      var chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = !!t.feito;
      chk.addEventListener("change", function(){
        t.feito = chk.checked;
        li.className = t.feito ? "feito" : "";
        onChange();
      });
      li.appendChild(chk);

      var txt = document.createElement("span");
      txt.className = "txt";
      txt.textContent = t.titulo;
      li.appendChild(txt);

      var rm = document.createElement("button");
      rm.className = "icon-btn";
      rm.title = "Remover";
      rm.innerHTML = "&times;";
      rm.addEventListener("click", function(){
        fase.tarefas = fase.tarefas.filter(function(x){ return x.id !== t.id; });
        onChange();
        render(root, fase, onChange);
      });
      li.appendChild(rm);

      tarefasList.appendChild(li);
    });

    entregaveisArea.value = fase.entregaveis.map(function(e){ return e.texto; }).join("\n");
  }

  function mount(rootEl, fase, onChange){
    var tpl = document.getElementById("placeholder-template");
    rootEl.innerHTML = "";
    rootEl.appendChild(tpl.content.cloneNode(true));

    var input = rootEl.querySelector(".placeholder-add-input");
    var addBtn = rootEl.querySelector(".placeholder-add-btn");

    function addTarefa(){
      var titulo = input.value.trim();
      if(!titulo) return;
      fase.tarefas.push({id: uid(), titulo: titulo, feito: false});
      input.value = "";
      onChange();
      render(rootEl, fase, onChange);
    }
    addBtn.addEventListener("click", addTarefa);
    input.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); addTarefa(); } });

    var entregaveisArea = rootEl.querySelector(".placeholder-entregaveis-text");
    entregaveisArea.addEventListener("change", function(){
      var linhas = entregaveisArea.value.split("\n").map(function(l){ return l.trim(); }).filter(Boolean);
      fase.entregaveis = linhas.map(function(texto, i){
        return {id: (fase.entregaveis[i] && fase.entregaveis[i].id) || uid(), texto: texto};
      });
      onChange();
    });

    render(rootEl, fase, onChange);
  }

  return { mount: mount };
})();
