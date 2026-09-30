"use strict";

/* =========================
   SmartSpend - JavaScript
   Concepts: DOM, events, arrays,
   objects, functions, callbacks,
   higher-order methods, localStorage,
   JSON, Date, filtering, sorting,
   import/export and theme state.
========================= */

const STORAGE_KEY = "smartSpendExpenses";
const BUDGET_KEY = "smartSpendBudget";
const THEME_KEY = "smartSpendTheme";

const categories = ["Food","Transport","Shopping","Bills","Entertainment","Health","Education","Travel","Other"];
let expenses = loadExpenses();
let editingId = null;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const money = value => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(value || 0);
const today = () => new Date().toISOString().slice(0,10);
const monthKey = date => date.slice(0,7);
const currentMonth = () => today().slice(0,7);
const formatDate = date => new Date(date + "T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});

function loadExpenses(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(error){ console.error(error); return []; }
}
function saveExpenses(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}
function getBudget(){
  return Number(localStorage.getItem(BUDGET_KEY)) || 0;
}
function setBudget(value){
  localStorage.setItem(BUDGET_KEY, String(value));
}
function uid(){
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2);
}
function showToast(message){
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(()=>toast.classList.remove("show"),2200);
}

function populateCategories(){
  $("#category").innerHTML = categories.map(c=>`<option value="${c}">${c}</option>`).join("");
  $("#filterCategory").innerHTML = `<option value="">All categories</option>` + categories.map(c=>`<option value="${c}">${c}</option>`).join("");
}
populateCategories();

function render(){
  renderStats();
  renderBudget();
  renderChart();
  renderCategories();
  renderTable();
}

function renderStats(){
  const total = expenses.reduce((sum,e)=>sum+e.amount,0);
  const month = currentMonth();
  const monthly = expenses.filter(e=>monthKey(e.date)===month).reduce((sum,e)=>sum+e.amount,0);
  const budget = getBudget();
  const remaining = budget - monthly;

  $("#total").textContent = money(total);
  $("#monthly").textContent = money(monthly);
  $("#remaining").textContent = budget ? money(remaining) : "₹0";
  $("#remaining").className = "stat-value " + (remaining < 0 ? "orange" : "green");
  $("#average").textContent = money(expenses.length ? total/expenses.length : 0);
  $("#totalCount").textContent = `${expenses.length} transaction${expenses.length===1?"":"s"}`;
  $("#monthName").textContent = new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"});
  $("#budgetHint").textContent = budget ? (remaining < 0 ? "Budget exceeded" : "Available this month") : "Set a monthly budget";
  $("#selectedMonthLabel").textContent = new Date(month+"-01").toLocaleDateString("en-IN",{month:"short",year:"numeric"});
}

function renderBudget(){
  const budget = getBudget();
  const monthly = expenses.filter(e=>monthKey(e.date)===currentMonth()).reduce((s,e)=>s+e.amount,0);
  const percent = budget ? Math.min((monthly/budget)*100,100) : 0;
  $("#budgetAmount").textContent = money(budget);
  $("#spentText").textContent = `Spent ${money(monthly)}`;
  $("#budgetPercent").textContent = budget ? `${Math.round((monthly/budget)*100)}%` : "0%";
  $("#budgetFill").style.width = percent + "%";
  $("#budgetFill").classList.toggle("over", budget > 0 && monthly > budget);
}

function renderChart(){
  const month = currentMonth();
  const days = new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
  const daily = Array.from({length:days},(_,i)=>({
    day:i+1,
    total:expenses.filter(e=>e.date===`${month}-${String(i+1).padStart(2,"0")}`).reduce((s,e)=>s+e.amount,0)
  }));
  const max = Math.max(...daily.map(d=>d.total),1);
  $("#chart").innerHTML = daily.map(d=>`
    <div class="bar-wrap" title="${d.day}: ${money(d.total)}">
      <span class="bar-value">${d.total ? Math.round(d.total) : ""}</span>
      <div class="bar" style="height:${Math.max((d.total/max)*82,d.total?4:1)}%"></div>
      <span class="bar-label">${d.day}</span>
    </div>`).join("");
}

function renderCategories(){
  const month = currentMonth();
  const values = categories.map(category=>({
    category,
    total:expenses.filter(e=>e.category===category && monthKey(e.date)===month).reduce((s,e)=>s+e.amount,0)
  })).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const max = Math.max(...values.map(v=>v.total),1);
  $("#categoryTotal").textContent = `${values.length} active categories`;
  $("#categories").innerHTML = values.length ? values.map(v=>`
    <div class="cat-row"><span>${v.category}</span><div class="track"><i style="width:${v.total/max*100}%"></i></div><strong>${money(v.total)}</strong></div>
  `).join("") : `<div class="empty">No expenses recorded for this month.</div>`;
}

function getFilteredExpenses(){
  const search = $("#search").value.trim().toLowerCase();
  const category = $("#filterCategory").value;
  const month = $("#filterMonth").value;
  const sort = $("#sort").value;

  let result = expenses.filter(e=>{
    const text = `${e.name} ${e.category} ${e.payment} ${e.note || ""}`.toLowerCase();
    return (!search || text.includes(search))
      && (!category || e.category===category)
      && (!month || monthKey(e.date)===month);
  });

  const comparators = {
    "date-desc":(a,b)=>b.date.localeCompare(a.date),
    "date-asc":(a,b)=>a.date.localeCompare(b.date),
    "amount-desc":(a,b)=>b.amount-a.amount,
    "amount-asc":(a,b)=>a.amount-b.amount,
    "name-asc":(a,b)=>a.name.localeCompare(b.name)
  };
  return result.sort(comparators[sort]);
}

function escapeHTML(value){
  return String(value ?? "").replace(/[&<>"']/g, char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}

function renderTable(){
  const list = getFilteredExpenses();
  $("#resultCount").textContent = `${list.length} result${list.length===1?"":"s"}`;
  $("#expenseBody").innerHTML = list.length ? list.map(e=>`
    <tr>
      <td>${formatDate(e.date)}</td>
      <td><strong>${escapeHTML(e.name)}</strong>${e.note?`<div class="subtitle">${escapeHTML(e.note)}</div>`:""}</td>
      <td><span class="pill">${escapeHTML(e.category)}</span></td>
      <td>${escapeHTML(e.payment)}</td>
      <td class="amount">${money(e.amount)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" title="Edit" data-action="edit" data-id="${e.id}">✎</button>
        <button class="icon-btn" title="Delete" data-action="delete" data-id="${e.id}">×</button>
      </div></td>
    </tr>`).join("") : `<tr><td colspan="6"><div class="empty">No expenses found. Add your first expense.</div></td></tr>`;
}

function openExpenseModal(expense=null){
  editingId = expense?.id || null;
  $("#modalTitle").textContent = expense ? "Edit Expense" : "Add Expense";
  $("#expenseId").value = expense?.id || "";
  $("#name").value = expense?.name || "";
  $("#amount").value = expense?.amount || "";
  $("#date").value = expense?.date || today();
  $("#category").value = expense?.category || "Food";
  $("#payment").value = expense?.payment || "UPI";
  $("#note").value = expense?.note || "";
  $("#modalBackdrop").classList.add("show");
  setTimeout(()=>$("#name").focus(),50);
}
function closeExpenseModal(){ $("#modalBackdrop").classList.remove("show"); editingId=null; }

$("#addBtn").addEventListener("click",()=>openExpenseModal());
$("#cancelBtn").addEventListener("click",closeExpenseModal);
$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeExpenseModal()});

$("#expenseForm").addEventListener("submit",e=>{
  e.preventDefault();
  const data = {
    id: editingId || uid(),
    name: $("#name").value.trim(),
    amount: Number($("#amount").value),
    date: $("#date").value,
    category: $("#category").value,
    payment: $("#payment").value,
    note: $("#note").value.trim()
  };
  if(!data.name || !data.date || data.amount<=0) return;
  if(editingId){
    expenses = expenses.map(item=>item.id===editingId ? data : item);
    showToast("Expense updated");
  }else{
    expenses.push(data);
    showToast("Expense added");
  }
  saveExpenses(); render(); closeExpenseModal();
});

$("#expenseBody").addEventListener("click",e=>{
  const button = e.target.closest("[data-action]");
  if(!button) return;
  const id = button.dataset.id;
  const expense = expenses.find(x=>x.id===id);
  if(button.dataset.action==="edit") openExpenseModal(expense);
  if(button.dataset.action==="delete"){
    if(confirm(`Delete "${expense.name}"?`)){
      expenses = expenses.filter(x=>x.id!==id);
      saveExpenses(); render(); showToast("Expense deleted");
    }
  }
});

["search","filterCategory","filterMonth","sort"].forEach(id=>$( "#"+id ).addEventListener("input",renderTable));
$("#clearFilters").addEventListener("click",()=>{
  $("#search").value="";$("#filterCategory").value="";$("#filterMonth").value="";$("#sort").value="date-desc";renderTable();
});

$("#budgetBtn").addEventListener("click",()=>{
  $("#budgetInput").value=getBudget() || "";
  $("#budgetModal").classList.add("show"); $("#budgetInput").focus();
});
$("#budgetCancel").addEventListener("click",()=>$("#budgetModal").classList.remove("show"));
$("#budgetModal").addEventListener("click",e=>{if(e.target.id==="budgetModal")$("#budgetModal").classList.remove("show")});
$("#budgetForm").addEventListener("submit",e=>{
  e.preventDefault();
  const value=Number($("#budgetInput").value);
  setBudget(Math.max(0,value)); render(); $("#budgetModal").classList.remove("show"); showToast("Budget saved");
});

$("#exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({expenses,budget:getBudget(),exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url;a.download=`smart-expenses-${today()}.json`;a.click();URL.revokeObjectURL(url);showToast("Expenses exported");
});
$("#importBtn").addEventListener("click",()=>$("#fileInput").click());
$("#fileInput").addEventListener("change",e=>{
  const file=e.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.addEventListener("load",()=>{
    try{
      const data=JSON.parse(reader.result);
      const imported=Array.isArray(data)?data:data.expenses;
      if(!Array.isArray(imported)) throw new Error("Invalid file");
      const clean=imported.filter(x=>x && x.name && x.date && Number(x.amount)>0).map(x=>({
        id:x.id || uid(),name:String(x.name),amount:Number(x.amount),date:String(x.date).slice(0,10),
        category:categories.includes(x.category)?x.category:"Other",payment:x.payment||"Other",note:x.note||""
      }));
      expenses=clean; if(data.budget!=null)setBudget(Number(data.budget));
      saveExpenses();render();showToast(`${clean.length} expenses imported`);
    }catch(error){alert("Invalid JSON expense file.");}
    e.target.value="";
  });
  reader.readAsText(file);
});

$("#themeBtn").addEventListener("click",()=>{
  const dark=document.documentElement.dataset.theme==="dark";
  document.documentElement.dataset.theme=dark?"light":"dark";
  localStorage.setItem(THEME_KEY,dark?"light":"dark");
  updateThemeButton();
});
function updateThemeButton(){
  const dark=document.documentElement.dataset.theme==="dark";
  $("#themeIcon").textContent = dark ? "☀" : "☾";
  $("#themeLabel").textContent = dark ? "Light" : "Dark";
  $("#themeBtn").setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}
document.documentElement.dataset.theme=localStorage.getItem(THEME_KEY)||"light";
updateThemeButton();

$$(".nav button").forEach(btn=>btn.addEventListener("click",()=>{
  $$(".nav button").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
  document.getElementById(btn.dataset.scroll).scrollIntoView({behavior:"smooth"});
  $("#sidebar").classList.remove("open");
}));
$("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){closeExpenseModal();$("#budgetModal").classList.remove("show")}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="n"){e.preventDefault();openExpenseModal()}
});

render();
