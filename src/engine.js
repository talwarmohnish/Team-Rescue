export const DAILY_HOURS = 4;
export const normalizeSkills = (value) => [...new Set((Array.isArray(value) ? value : value.split(',')).map(s => s.trim().toLowerCase()).filter(Boolean))];
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function addDays(date, count) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+count); return localDate(d); }
export const dayDistance = (a,b) => Math.round((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000);
export const hasSkills = (member, task) => task.skills.every(s => member.skills.includes(s));
const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
export function topological(tasks) {
  const ordered = [], remaining = new Map(tasks.map(t=>[t.id,t]));
  while (remaining.size) {
    const ready = [...remaining.values()].filter(t=>t.dependencies.every(d=>ordered.some(x=>x.id===d))).sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.id.localeCompare(b.id));
    if (!ready.length) throw new Error('Dependencies must refer to existing tasks and cannot form a cycle.');
    const next=ready[0]; ordered.push(next); remaining.delete(next.id);
  }
  return ordered;
}
export function affectedTasks(project) {
  const affected = new Set();
  const load = {};
  for (const task of topological(project.tasks)) {
    const member=project.members.find(m=>m.id===task.assignee);
    load[task.assignee]=(load[task.assignee]||0)+task.effort;
    if (!member || !member.available || !hasSkills(member,task) || load[task.assignee]>member.hours || task.dependencies.some(d=>affected.has(d))) affected.add(task.id);
  }
  return affected;
}
// Bounded deterministic search. Time is measured in 4-hour calendar-day work blocks.
// Every original assignment is preferred; maximizing schedulable tasks takes priority.
export function recover(project) {
  const ordered=topological(project.tasks), available=project.members.filter(m=>m.available);
  let visited=0, best=null;
  const limit=40000;
  function search(index, assignments, loads, ends, finish, reasons, count, changes) {
    if (++visited>limit) return;
    if (best && count+ordered.length-index<best.count) return;
    if (index===ordered.length) {
      if (!best || count>best.count || (count===best.count && changes<best.changes)) best={assignments,loads,finish,reasons,count,changes};
      return;
    }
    const task=ordered[index];
    const blocked=task.dependencies.find(d=>!assignments[d]);
    const skilled=available.filter(m=>hasSkills(m,task));
    const capacity=skilled.filter(m=>(loads[m.id]||0)+task.effort<=m.hours+1e-9);
    const deadline=(dayDistance(project.startDate,task.deadline)+1)*DAILY_HOURS;
    const earliest=Math.max(0,...task.dependencies.map(d=>finish[d]||0));
    const candidates=blocked ? [] : capacity.map(m=>({m,end:Math.max(earliest,ends[m.id]||0)+task.effort})).filter(c=>c.end<=deadline+1e-9).sort((a,b)=>(a.m.id===task.assignee?-1:0)-(b.m.id===task.assignee?-1:0)||(loads[a.m.id]||0)/Math.max(a.m.hours,1)-(loads[b.m.id]||0)/Math.max(b.m.hours,1)||a.m.id.localeCompare(b.m.id));
    for (const {m,end} of candidates) search(index+1,{...assignments,[task.id]:m.id},{...loads,[m.id]:(loads[m.id]||0)+task.effort},{...ends,[m.id]:end},{...finish,[task.id]:end},reasons,count+1,changes+(m.id!==task.assignee?1:0));
    const reason=blocked ? `Waiting on dependency: ${project.tasks.find(t=>t.id===blocked)?.title || blocked}.` : !skilled.length ? `No available teammate has all required skills (${task.skills.join(', ')}).` : !capacity.length ? `Qualified teammates do not have ${task.effort} hours remaining.` : 'Cannot finish before the deadline with current capacity and dependencies.';
    search(index+1,{...assignments,[task.id]:null},loads,ends,finish,{...reasons,[task.id]:reason},count,changes);
  }
  search(0,{},{},{},{},{},0,0);
  return {...best, visited, limited:visited>limit, generatedAt:new Date().toISOString()};
}
export function sampleProject() {
  const startDate=localDate();
  return {version:1,name:'Campus Connect',course:'CS 302 · Software Engineering',startDate,
    members:[
      {id:'m1',name:'Alex Morgan',role:'Frontend lead',skills:['react','design','data visualization'],hours:16,available:true,color:'violet'},
      {id:'m2',name:'Priya Sharma',role:'UI / UX designer',skills:['design','research','presentation'],hours:16,available:true,color:'rose'},
      {id:'m3',name:'Jordan Lee',role:'Full-stack developer',skills:['react','api','testing'],hours:20,available:true,color:'blue'},
      {id:'m4',name:'Sam Rivera',role:'Research & QA',skills:['research','testing','writing','presentation'],hours:16,available:true,color:'amber'},
    ],tasks:[
      {id:'t1',title:'Student discovery',skills:['research'],effort:4,deadline:addDays(startDate,1),assignee:'m4',dependencies:[]},
      {id:'t2',title:'Interface design',skills:['design'],effort:5,deadline:addDays(startDate,3),assignee:'m1',dependencies:['t1']},
      {id:'t3',title:'API integration',skills:['api'],effort:6,deadline:addDays(startDate,3),assignee:'m3',dependencies:['t1']},
      {id:'t4',title:'React dashboard',skills:['react'],effort:7,deadline:addDays(startDate,6),assignee:'m1',dependencies:['t2','t3']},
      {id:'t5',title:'Analytics charts',skills:['data visualization'],effort:4,deadline:addDays(startDate,7),assignee:'m1',dependencies:['t3']},
      {id:'t6',title:'Usability testing',skills:['testing'],effort:4,deadline:addDays(startDate,8),assignee:'m4',dependencies:['t4']},
      {id:'t7',title:'Project report',skills:['writing'],effort:5,deadline:addDays(startDate,8),assignee:'m4',dependencies:['t1']},
      {id:'t8',title:'Final presentation',skills:['presentation'],effort:3,deadline:addDays(startDate,9),assignee:'m2',dependencies:['t6','t7']},
    ]};
}
export function validateProject(p) {
  if (!p || p.version!==1 || typeof p.name!=='string' || !p.name.trim() || !Array.isArray(p.members) || !Array.isArray(p.tasks) || p.members.length>30 || p.tasks.length>40 || !validDate(p.startDate)) return false;
  const ids=new Set();
  for (const m of p.members) {
    if (!m || typeof m.id!=='string' || ids.has(m.id) || typeof m.name!=='string' || !m.name.trim() || !Array.isArray(m.skills) || !m.skills.every(s=>typeof s==='string') || !Number.isFinite(m.hours) || m.hours<0 || typeof m.available!=='boolean') return false;
    ids.add(m.id);
  }
  const taskIds=new Set();
  for (const t of p.tasks) {
    if (!t || typeof t.id!=='string' || taskIds.has(t.id) || typeof t.title!=='string' || !t.title.trim() || !Array.isArray(t.skills) || !t.skills.length || !t.skills.every(s=>typeof s==='string') || !Number.isFinite(t.effort) || t.effort<=0 || !validDate(t.deadline) || !Array.isArray(t.dependencies) || !t.dependencies.every(s=>typeof s==='string') || (t.assignee!==null && typeof t.assignee!=='string')) return false;
    taskIds.add(t.id);
  }
  try { topological(p.tasks); return true; } catch {return false;}
}
