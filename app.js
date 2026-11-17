const STORE_KEY = "qms_change_tracker_v2";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let records = load();
let currentView = "dashboard";
let toastTimer;

function load(){ try{return JSON.parse(localStorage.getItem(STORE_KEY))||[]}catch(e){return []} }
function save(){ localStorage.setItem(STORE_KEY,JSON.stringify(records)); render(); }
function uid(){return "CHG-"+new Date().getFullYear()+"-"+Math.random().toString(36).slice(2,7).toUpperCase()}
function today(){return new Date().toISOString().slice(0,10)}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dateText(v){return v?new Date(v+"T00:00:00").toLocaleDateString("ko-KR"):"미정"}
function notify(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2300)}
function statusClass(s){if(s==="완료")return"green";if(s==="보류"||s==="승인 대기")return"amber";return""}
function getRecord(id){return records.find(x=>x.id===id)}
function filtered(){const q=$("#searchInput").value.trim().toLowerCase(),st=$("#statusFilter").value;return records.filter(r=>(!st||r.status===st)&&(!q||[r.id,r.title,r.requester,r.type].join(" ").toLowerCase().includes(q))).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""))}
function isOverdue(r){return r.dueDate&&r.dueDate<today()&&r.status!=="완료"&&r.status!=="보류"}
function pendingDocs(r){return (r.documents||[]).filter(d=>!d.received)}
function allTasksDone(r){return !(r.tasks||[]).some(t=>!t.done)}
function render(){
  renderStats(); renderDashboard(); renderChanges(); renderFollowups();
  $$(".view").forEach(v=>v.classList.add("hidden"));
  $("#"+currentView+"View").classList.remove("hidden");
  $$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));
}
function renderStats(){
 const total=records.length,active=records.filter(r=>r.status!=="완료"&&r.status!=="보류").length,over=records.filter(isOverdue).length,pending=records.reduce((n,r)=>n+pendingDocs(r).length,0);
 const stats=[["전체 변경",total,"누적 등록 건수","▦"],["진행 중",active,"완료·보류 제외","↗"],["기한 초과",over,"목표 완료일 경과","!"],["미수령 문서",pending,"배포 후 수령 확인 필요","▤"]];
 $("#stats").innerHTML=stats.map((s,i)=>`<div class="stat"><div class="stat-top"><span>${s[0]}</span><span class="stat-icon">${s[3]}</span></div><div class="stat-value">${s[1]}</div><div class="stat-sub">${s[2]}</div></div>`).join("");
}
function renderDashboard(){
 const stages=["등록","영향 평가","승인 대기","변경 실행","완료 보고","문서 배포","완료","보류"];
 const max=Math.max(1,...stages.map(s=>records.filter(r=>r.status===s).length));
 const stageHtml=stages.map(s=>{let n=records.filter(r=>r.status===s).length;return `<div class="stage-row"><span>${s}</span><div class="bar"><span style="width:${n/max*100}%"></span></div><span class="stage-count">${n}</span></div>`}).join("");
 const attention=records.flatMap(r=>[
  ...(isOverdue(r)?[{r,title:"목표 완료일 초과",sub:`완료 목표일 ${dateText(r.dueDate)}`,kind:"red"}]:[]),
  ...(pendingDocs(r).length?[{r,title:`미수령 문서 ${pendingDocs(r).length}건`,sub:pendingDocs(r).map(d=>d.name).join(", "),kind:"amber"}]:[]),
  ...((r.tasks||[]).some(t=>!t.done)?[{r,title:`미완료 후속 업무 ${(r.tasks||[]).filter(t=>!t.done).length}건`,sub:(r.tasks||[]).filter(t=>!t.done).map(t=>t.title).slice(0,2).join(", "),kind:""}]:[])
 ]).slice(0,7);
 $("#dashboardView").innerHTML=`<div class="dashboard-grid">
  <div class="panel"><div class="section-head"><div><h3>단계별 진행 현황</h3><p>현재 등록된 변경 건의 단계별 분포</p></div></div><div class="stage-list">${stageHtml}</div></div>
  <div class="panel"><div class="section-head"><div><h3>우선 확인 항목</h3><p>기한 초과, 미수령 문서, 미완료 업무</p></div><button class="small-btn" data-go="followups">전체 보기</button></div>
  <div class="attention-list">${attention.length?attention.map(a=>`<div class="attention-item"><div><strong>${esc(a.r.title)} · ${esc(a.title)}</strong><small>${esc(a.sub)}</small></div><button class="small-btn" data-open="${a.r.id}">확인</button></div>`).join(""):`<div class="empty">현재 우선 확인 항목이 없습니다.</div>`}</div></div>
 </div>
 <div class="section-head"><div><h3>최근 변경 건</h3><p>최근 수정한 변경 건을 빠르게 확인합니다.</p></div><button class="small-btn primary" id="dashNew">＋ 변경 등록</button></div>
 ${tableHTML(records.slice().sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||"")).slice(0,6))}`;
}
function tableHTML(list){
 if(!list.length)return `<div class="panel empty"><strong>등록된 변경 건이 없습니다.</strong>‘변경 등록’ 버튼을 눌러 첫 변경 건을 추가하세요.</div>`;
 return `<div class="table-wrap"><table class="data-table"><thead><tr><th>변경번호 / 제목</th><th>유형</th><th>요청자</th><th>목표 완료일</th><th>진행 상태</th><th>확인 항목</th><th></th></tr></thead><tbody>${list.map(r=>`<tr>
 <td><button class="link-btn" data-open="${r.id}">${esc(r.title||"(제목 없음)")}</button><div class="muted">${esc(r.id)}</div></td><td>${esc(r.type||"-")}</td><td>${esc(r.requester||"-")}</td><td>${dateText(r.dueDate)} ${isOverdue(r)?'<span class="pill red">기한 초과</span>':""}</td><td><span class="pill ${statusClass(r.status)}">${esc(r.status)}</span></td><td>${pendingDocs(r).length?`<span class="pill amber">문서 ${pendingDocs(r).length}건</span>`:""} ${(r.tasks||[]).some(t=>!t.done)?`<span class="pill">업무 미완료</span>`:""} ${!pendingDocs(r).length&&allTasksDone(r)?"-":""}</td><td><button class="small-btn" data-open="${r.id}">상세</button></td>
 </tr>`).join("")}</tbody></table></div>`;
}
function renderChanges(){const list=filtered();$("#changesView").innerHTML=`<div class="section-head"><div><h3>변경관리대장</h3><p>총 ${list.length}건 · 변경 건을 선택하면 단계별 기록을 관리할 수 있습니다.</p></div><button class="btn btn-primary" id="listNew">＋ 변경 등록</button></div>${tableHTML(list)}`}
function renderFollowups(){
 const items=records.flatMap(r=>[
  ...(isOverdue(r)?[{r,kind:"기한 초과",desc:`목표 완료일: ${dateText(r.dueDate)}`,level:"red"}]:[]),
  ...pendingDocs(r).map(d=>({r,kind:"문서 수령 확인",desc:d.name+(d.distributionDate?` · 배포 ${dateText(d.distributionDate)}`:""),level:"amber"})),
  ...(r.tasks||[]).filter(t=>!t.done).map(t=>({r,kind:"후속 업무",desc:t.title+(t.dueDate?` · 예정 ${dateText(t.dueDate)}`:""),level:""}))
 ]);
 $("#followupsView").innerHTML=`<div class="section-head"><div><h3>확인 필요 업무</h3><p>완료 처리되지 않은 후속 조치를 모아 보여줍니다. 총 ${items.length}건</p></div></div>${items.length?items.map(i=>`<div class="followup-card"><div><strong>${esc(i.r.title)} <span class="pill ${i.level}">${i.kind}</span></strong><p>${esc(i.r.id)} · ${esc(i.desc)}</p></div><button class="small-btn primary" data-open="${i.r.id}">업무 확인</button></div>`).join(""):`<div class="panel empty"><strong>확인할 업무가 없습니다.</strong>미수령 문서와 미완료 업무가 모두 정리되었습니다.</div>`}`;
}
function showView(v){currentView=v;render()}
function openForm(r=null){
 $("#changeForm").reset();$("#changeId").value=r?.id||"";$("#dialogTitle").textContent=r?"변경 정보 수정":"변경 등록";
 if(r){["title","type","requester","dueDate","grade","status","reason","description","memo"].forEach(k=>$("#"+k).value=r[k]??"")}
 else{$("#type").value="제품";$("#grade").value="일반";$("#status").value="등록"}
 $("#changeDialog").showModal();
}
function saveForm(e){
 e.preventDefault();let id=$("#changeId").value,old=getRecord(id);
 const data={id:id||uid(),title:$("#title").value.trim(),type:$("#type").value,requester:$("#requester").value.trim(),dueDate:$("#dueDate").value,grade:$("#grade").value,status:$("#status").value,reason:$("#reason").value,description:$("#description").value,memo:$("#memo").value,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),impact:old?.impact||[],impactResult:old?.impactResult||"",impactDate:old?.impactDate||"",completion:old?.completion||{},documents:old?.documents||[],tasks:old?.tasks||[],history:old?.history||[]};
 if(old){records=records.map(x=>x.id===id?data:x)}else{data.history.push({date:today(),text:"변경 건 등록"});records.unshift(data)}
 $("#changeDialog").close();save();notify(old?"변경 정보가 수정되었습니다.":"변경 건이 등록되었습니다.");openDetail(data.id);
}
function addHistory(r,text){r.history=r.history||[];r.history.unshift({date:today(),text});r.updatedAt=new Date().toISOString()}
function detailField(label,value){return `<div class="detail-field"><small>${label}</small><strong>${esc(value||"-")}</strong></div>`}
function openDetail(id){
 const r=getRecord(id);if(!r)return;
 const impact=r.impact||[],docs=r.documents||[],tasks=r.tasks||[],c=r.completion||{};
 $("#detailContent").innerHTML=`<div class="detail-wrap">
 <div class="detail-head"><div><p class="eyebrow">${esc(r.id)}</p><h2>${esc(r.title)}</h2><p>${esc(r.type)} · ${esc(r.grade)} · 등록 ${dateText(r.createdAt?.slice(0,10))}</p></div><div class="detail-actions"><button class="small-btn" data-edit="${r.id}">기본정보 수정</button><button class="icon-btn" data-close-detail>✕</button></div></div>
 <div class="detail-section"><div class="detail-grid">${detailField("요청자 / 관련자",r.requester)}${detailField("목표 완료일",dateText(r.dueDate))}${detailField("진행 상태",r.status)}${detailField("변경 유형",r.type)}${detailField("변경 중요도",r.grade)}${detailField("최근 수정",r.updatedAt?new Date(r.updatedAt).toLocaleString("ko-KR"):"-")}</div><h3 style="margin-top:14px">변경 사유 및 목적</h3><div class="detail-text">${esc(r.reason||"기록 없음")}</div><h3 style="margin-top:14px">변경 전 / 변경 후</h3><div class="detail-text">${esc(r.description||"기록 없음")}</div><h3 style="margin-top:14px">메모 및 다음 조치</h3><div class="detail-text">${esc(r.memo||"기록 없음")}</div></div>

 <div class="detail-section"><h3>1. 영향 평가</h3>
 <div class="subform"><div class="subhead"><strong>영향 평가 항목 추가</strong><span class="muted">평가 대상과 결과를 항목별로 기록</span></div>
 <div class="subform-grid"><label>평가 분야<input id="impactArea" placeholder="예: 제품 품질 / 공정 / 밸리데이션 / 인허가"></label><label>평가 결과<select id="impactDecision"><option>영향 없음</option><option>영향 있음</option><option>추가 검토 필요</option><option>해당 없음</option></select></label><label style="grid-column:1/-1">평가 내용 및 근거<textarea id="impactNote" rows="2" placeholder="검토 내용, 객관적 근거, 필요한 조치"></textarea></label></div><div style="text-align:right;margin-top:9px"><button class="small-btn primary" data-add-impact="${r.id}">평가 항목 추가</button></div></div>
 ${impact.length?`<div class="item-list">${impact.map((x,i)=>`<div class="item-card"><div><strong>${esc(x.area)} <span class="pill">${esc(x.decision)}</span></strong><small>${esc(x.note)} · ${dateText(x.date)}</small></div><button class="small-btn" data-del-impact="${r.id}" data-index="${i}">삭제</button></div>`).join("")}</div>`:`<p class="muted">등록된 영향 평가 항목이 없습니다.</p>`}
 <label class="checkline" style="margin-top:13px">영향 평가 완료 <input type="checkbox" id="impactDone" ${r.impactDone?"checked":""}></label>
 <label style="display:block;margin-top:10px;font-size:11px;color:#667085">종합 평가 결론<textarea id="impactResult" class="inline-input" style="display:block;width:100%;margin-top:6px" rows="2" placeholder="종합적인 영향 평가 결과 및 후속 조치">${esc(r.impactResult||"")}</textarea></label>
 <div style="text-align:right;margin-top:9px"><button class="small-btn primary" data-save-impact="${r.id}">영향 평가 저장</button></div></div>

 <div class="detail-section"><h3>2. 완료 보고서</h3>
 <div class="subform"><div class="subform-grid">
 <label>실행 완료일<input id="completionDate" type="date" value="${esc(c.date||"")}"></label>
 <label>실행 담당자<input id="completionOwner" value="${esc(c.owner||"")}" placeholder="실행 담당자"></label>
 <label style="grid-column:1/-1">실행 및 조치 결과<textarea id="completionAction" rows="2" placeholder="실제 수행한 변경 내용과 결과">${esc(c.action||"")}</textarea></label>
 <label style="grid-column:1/-1">검증 / 확인 결과<textarea id="completionVerification" rows="2" placeholder="검증 방법, 결과, 객관적 증빙">${esc(c.verification||"")}</textarea></label>
 <label style="grid-column:1/-1">교육 및 문서 개정 / 기타 후속 조치<textarea id="completionFollowup" rows="2" placeholder="교육 실시, 문서 개정, 잔여 조치 등">${esc(c.followup||"")}</textarea></label>
 <label>완료 보고서 작성자<input id="completionWriter" value="${esc(c.writer||"")}" placeholder="작성자"></label>
 <label>완료 보고일<input id="completionReportDate" type="date" value="${esc(c.reportDate||"")}"></label>
 </div><div style="text-align:right;margin-top:10px"><button class="small-btn primary" data-save-completion="${r.id}">완료 보고서 저장</button></div></div>
 <p class="muted">영향 평가 결과와 실행·검증 내용을 입력한 후 완료 보고서를 저장하세요. 저장 후 진행 상태를 ‘완료 보고’로 변경할 수 있습니다.</p></div>

 <div class="detail-section"><h3>3. 출력문서 배포 및 수령 모니터링</h3>
 <p class="muted">배포해야 할 문서를 직접 기재하세요. 수령 확인을 하면 미수령 목록에서 빠지고 수령 이력으로 이동합니다.</p>
 <div class="subform"><div class="subform-grid">
 <label>문서명 / 문서번호<input id="docName" placeholder="예: 작업표준서 / SOP-001"></label>
 <label>배포 대상 / 수령 부서<input id="docRecipient" placeholder="예: 생산팀 / 품질팀"></label>
 <label>배포일<input id="docDate" type="date" value="${today()}"></label>
 <label>요청 수령일<input id="docDue" type="date"></label>
 <label style="grid-column:1/-1">비고<input id="docNote" placeholder="개정번호, 배포 방법, 참고사항 등"></label>
 </div><div style="text-align:right;margin-top:10px"><button class="small-btn primary" data-add-doc="${r.id}">배포 문서 등록</button></div></div>
 <h4 style="font-size:12px;margin:15px 0 8px">미수령 문서 (${pendingDocs(r).length})</h4>
 ${docs.filter(d=>!d.received).length?`<div class="item-list">${docs.filter(d=>!d.received).map(d=>`<div class="item-card"><div><strong>${esc(d.name)}</strong><small>대상: ${esc(d.recipient||"-")} · 배포: ${dateText(d.distributionDate)} · 수령 요청: ${dateText(d.dueDate)}${d.note?" · "+esc(d.note):""}</small></div><div class="item-meta"><button class="small-btn primary" data-receive-doc="${r.id}" data-doc="${d.id}">수령 확인</button><button class="small-btn" data-delete-doc="${r.id}" data-doc="${d.id}">삭제</button></div></div>`).join("")}</div>`:`<p class="muted">미수령 문서가 없습니다.</p>`}
 <h4 style="font-size:12px;margin:17px 0 8px">수령 완료 이력 (${docs.filter(d=>d.received).length})</h4>
 ${docs.filter(d=>d.received).length?`<div class="item-list">${docs.filter(d=>d.received).map(d=>`<div class="item-card"><div><strong>${esc(d.name)} <span class="pill green">수령 완료</span></strong><small>대상: ${esc(d.recipient||"-")} · 수령일: ${dateText(d.receivedDate)} · 배포: ${dateText(d.distributionDate)}</small></div><button class="small-btn" data-unreceive-doc="${r.id}" data-doc="${d.id}">미수령으로 되돌리기</button></div>`).join("")}</div>`:`<p class="muted">수령 완료 이력이 없습니다.</p>`}</div>

 <div class="detail-section"><h3>4. 후속 업무 / 누락 방지 체크</h3>
 <div class="subform"><div class="subform-grid"><label>확인할 업무<input id="taskTitle" placeholder="예: 개정 문서 교육 이수 확인"></label><label>완료 예정일<input id="taskDue" type="date"></label></div><div style="text-align:right;margin-top:9px"><button class="small-btn primary" data-add-task="${r.id}">업무 추가</button></div></div>
 ${tasks.length?`<div class="item-list">${tasks.map(t=>`<div class="item-card"><label class="checkline"><input type="checkbox" data-task-toggle="${r.id}" data-task="${t.id}" ${t.done?"checked":""}><span><strong style="${t.done?"text-decoration:line-through;color:#8a94a6":""}">${esc(t.title)}</strong><small>예정일: ${dateText(t.dueDate)} ${t.done?"· 완료 "+dateText(t.doneDate):"· 미완료"}</small></span></label><button class="small-btn" data-delete-task="${r.id}" data-task="${t.id}">삭제</button></div>`).join("")}</div>`:`<p class="muted">등록된 후속 업무가 없습니다.</p>`}</div>

 <div class="detail-section"><h3>5. 진행 상태 및 이력</h3><div class="subform"><div class="subform-grid"><label>진행 상태<select id="detailStatus">${["등록","영향 평가","승인 대기","변경 실행","완료 보고","문서 배포","완료","보류"].map(s=>`<option ${r.status===s?"selected":""}>${s}</option>`).join("")}</select></label><label>이력 메모<input id="historyNote" placeholder="상태 변경 또는 주요 확인 내용"></label></div><div style="text-align:right;margin-top:9px"><button class="small-btn primary" data-save-status="${r.id}">상태 및 이력 저장</button></div></div>
 ${r.history?.length?`<div class="item-list">${r.history.map(h=>`<div class="item-card"><div><strong>${dateText(h.date)}</strong><small>${esc(h.text)}</small></div></div>`).join("")}</div>`:`<p class="muted">진행 이력이 없습니다.</p>`}</div>
 <div class="detail-actions"><button class="small-btn" data-print="${r.id}">이 변경 건 인쇄</button><button class="small-btn" data-delete-record="${r.id}" style="color:#b42318">변경 건 삭제</button></div>
 </div>`;
 $("#detailDialog").showModal();
}
function updateRecord(id,fn){const r=getRecord(id);if(!r)return;fn(r);r.updatedAt=new Date().toISOString();save();openDetail(id)}
function exportCSV(){
 const rows=[["변경번호","제목","유형","요청자","중요도","상태","목표완료일","영향평가완료","미수령문서수","미완료업무수","완료보고일"],...records.map(r=>[r.id,r.title,r.type,r.requester,r.grade,r.status,r.dueDate,r.impactDone?"Y":"N",pendingDocs(r).length,(r.tasks||[]).filter(t=>!t.done).length,r.completion?.reportDate||""])];
 const csv="\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");download(new Blob([csv],{type:"text/csv;charset=utf-8"}),"변경관리대장.csv");
}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href)}
function printRecord(id){const r=getRecord(id);if(!r)return;const w=window.open("","_blank");if(!w){notify("팝업을 허용한 후 다시 시도하세요.");return}
 w.document.write(`<html lang="ko"><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#222}h1{font-size:22px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #aaa;padding-bottom:7px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}th{background:#f3f4f6;width:20%}pre{white-space:pre-wrap;font:12px/1.6 Arial}</style></head><body><h1>변경관리 기록</h1><p>${esc(r.id)} · 출력일 ${today()}</p><h2>기본 정보</h2><table>${[["제목",r.title],["유형",r.type],["요청자",r.requester],["중요도",r.grade],["상태",r.status],["목표 완료일",r.dueDate]].map(x=>`<tr><th>${x[0]}</th><td>${esc(x[1]||"-")}</td></tr>`).join("")}</table><h2>변경 사유 및 내용</h2><pre>${esc(r.reason)}\n\n${esc(r.description)}</pre><h2>영향 평가</h2><pre>${esc(r.impactResult)}\n${(r.impact||[]).map(x=>`${x.area} / ${x.decision}: ${x.note}`).join("\n")}</pre><h2>완료 보고</h2><pre>${esc(JSON.stringify(r.completion||{},null,2))}</pre><h2>배포 문서</h2><table><tr><th>문서</th><th>대상</th><th>배포일</th><th>수령일</th><th>상태</th></tr>${(r.documents||[]).map(d=>`<tr><td>${esc(d.name)}</td><td>${esc(d.recipient)}</td><td>${esc(d.distributionDate)}</td><td>${esc(d.receivedDate||"-")}</td><td>${d.received?"수령":"미수령"}</td></tr>`).join("")}</table><h2>후속 업무</h2><table><tr><th>업무</th><th>예정일</th><th>상태</th></tr>${(r.tasks||[]).map(t=>`<tr><td>${esc(t.title)}</td><td>${esc(t.dueDate)}</td><td>${t.done?"완료":"미완료"}</td></tr>`).join("")}</table><script>window.onload=()=>window.print()</script></body></html>`);w.document.close()}
$("#newChangeBtn").onclick=()=>openForm();$("#closeDialog").onclick=()=>$("#changeDialog").close();$("#cancelDialog").onclick=()=>$("#changeDialog").close();$("#changeForm").onsubmit=saveForm;
$("#searchInput").oninput=renderChanges;$("#statusFilter").onchange=renderChanges;
$$(".tab").forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.addEventListener("click",e=>{
 const t=e.target;
 if(t.matches("[data-go]"))showView(t.dataset.go);
 if(t.matches("[data-open]"))openDetail(t.dataset.open);
 if(t.matches("#dashNew,#listNew"))openForm();
 if(t.matches("[data-close-detail]"))$("#detailDialog").close();
 if(t.matches("[data-edit]")){let r=getRecord(t.dataset.edit);$("#detailDialog").close();openForm(r)}
 if(t.matches("[data-add-impact]")){let r=getRecord(t.dataset.addImpact),area=$("#impactArea").value.trim();if(!area){notify("평가 분야를 입력하세요.");return}updateRecord(r.id,x=>{x.impact.push({id:uid(),area,decision:$("#impactDecision").value,note:$("#impactNote").value,date:today()});addHistory(x,"영향 평가 항목 추가: "+area)})}
 if(t.matches("[data-del-impact]"))updateRecord(t.dataset.delImpact,r=>{r.impact.splice(+t.dataset.index,1);addHistory(r,"영향 평가 항목 삭제")});
 if(t.matches("[data-save-impact]"))updateRecord(t.dataset.saveImpact,r=>{r.impactDone=$("#impactDone").checked;r.impactResult=$("#impactResult").value;r.impactDate=today();addHistory(r,"영향 평가 내용 저장"+(r.impactDone?" 및 평가 완료":""))});
 if(t.matches("[data-save-completion]"))updateRecord(t.dataset.saveCompletion,r=>{r.completion={date:$("#completionDate").value,owner:$("#completionOwner").value,action:$("#completionAction").value,verification:$("#completionVerification").value,followup:$("#completionFollowup").value,writer:$("#completionWriter").value,reportDate:$("#completionReportDate").value};addHistory(r,"완료 보고서 저장")});
 if(t.matches("[data-add-doc]")){let name=$("#docName").value.trim();if(!name){notify("문서명 또는 문서번호를 입력하세요.");return}updateRecord(t.dataset.addDoc,r=>{r.documents.push({id:uid(),name,recipient:$("#docRecipient").value,distributionDate:$("#docDate").value,dueDate:$("#docDue").value,note:$("#docNote").value,received:false,receivedDate:""});addHistory(r,"배포 문서 등록: "+name)})}
 if(t.matches("[data-receive-doc]"))updateRecord(t.dataset.receiveDoc,r=>{let d=r.documents.find(x=>x.id===t.dataset.doc);if(d){d.received=true;d.receivedDate=today();addHistory(r,"문서 수령 확인: "+d.name)}});
 if(t.matches("[data-unreceive-doc]"))updateRecord(t.dataset.unreceiveDoc,r=>{let d=r.documents.find(x=>x.id===t.dataset.doc);if(d){d.received=false;d.receivedDate="";addHistory(r,"문서 수령 상태 되돌림: "+d.name)}});
 if(t.matches("[data-delete-doc]")){if(confirm("이 문서 기록을 완전히 삭제할까요? 수령 이력도 함께 삭제됩니다."))updateRecord(t.dataset.deleteDoc,r=>{r.documents=r.documents.filter(x=>x.id!==t.dataset.doc);addHistory(r,"배포 문서 기록 삭제")})}
 if(t.matches("[data-add-task]")){let title=$("#taskTitle").value.trim();if(!title){notify("업무 내용을 입력하세요.");return}updateRecord(t.dataset.addTask,r=>{r.tasks.push({id:uid(),title,dueDate:$("#taskDue").value,done:false,doneDate:""});addHistory(r,"후속 업무 추가: "+title)})}
 if(t.matches("[data-delete-task]"))updateRecord(t.dataset.deleteTask,r=>{r.tasks=r.tasks.filter(x=>x.id!==t.dataset.task);addHistory(r,"후속 업무 삭제")});
 if(t.matches("[data-save-status]"))updateRecord(t.dataset.saveStatus,r=>{let prev=r.status;r.status=$("#detailStatus").value;let note=$("#historyNote").value.trim();addHistory(r,`진행 상태 변경: ${prev} → ${r.status}`+(note?" / "+note:""))});
 if(t.matches("[data-print]"))printRecord(t.dataset.print);
 if(t.matches("[data-delete-record]")){if(confirm("이 변경 건과 모든 하위 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.")){records=records.filter(x=>x.id!==t.dataset.deleteRecord);$("#detailDialog").close();save();notify("변경 건이 삭제되었습니다.")}}
});
document.addEventListener("change",e=>{const t=e.target;if(t.matches("[data-task-toggle]")){const r=getRecord(t.dataset.taskToggle);if(!r)return;const task=r.tasks.find(x=>x.id===t.dataset.task);if(task){task.done=t.checked;task.doneDate=t.checked?today():"";addHistory(r,(t.checked?"후속 업무 완료: ":"후속 업무 미완료로 변경: ")+task.title);save();openDetail(r.id)}}});
$("#exportBackup").onclick=()=>download(new Blob([JSON.stringify({app:"QMS Change Tracker",version:2,exportedAt:new Date().toISOString(),records},null,2)],{type:"application/json"}),"변경관리_백업_"+today()+".json");
$("#importBackup").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());const arr=Array.isArray(data)?data:data.records;if(!Array.isArray(arr))throw Error("형식 오류");if(!confirm(`백업의 ${arr.length}건을 현재 데이터와 병합할까요? 같은 변경번호는 백업 내용으로 대체됩니다.`))return;const map=new Map(records.map(r=>[r.id,r]));arr.forEach(r=>map.set(r.id,r));records=[...map.values()];save();notify("백업 데이터를 불러왔습니다.")}catch(err){alert("백업 파일을 읽을 수 없습니다. 올바른 백업 JSON인지 확인하세요.")}e.target.value=""};
render();
