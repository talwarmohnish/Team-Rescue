import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleProject,recover,affectedTasks,hasSkills,topological,validateProject,normalizeSkills,dayDistance} from '../src/engine.js';

function assertFeasible(project,plan) {
  const load={}, intervals={};
  for(const task of topological(project.tasks)) {
    const owner=plan.assignments[task.id];
    if(!owner){assert.ok(plan.reasons[task.id]);continue;}
    const member=project.members.find(m=>m.id===owner);
    assert.ok(member?.available,`${task.title}: owner must be available`);
    assert.ok(hasSkills(member,task),`${task.title}: every skill must match`);
    load[owner]=(load[owner]||0)+task.effort;
    assert.ok(load[owner]<=member.hours+1e-9,`${member.name}: capacity exceeded`);
    assert.ok(plan.finish[task.id]<=(dayDistance(project.startDate,task.deadline)+1)*4+1e-9,`${task.title}: late`);
    const start=plan.finish[task.id]-task.effort;
    for(const dep of task.dependencies){assert.ok(plan.assignments[dep],`${task.title}: dependency blocked`);assert.ok(start>=plan.finish[dep]-1e-9,`${task.title}: dependency unfinished`);}
    for(const [a,b] of intervals[owner]||[])assert.ok(plan.finish[task.id]<=a+1e-9||start>=b-1e-9,`${member.name}: work overlaps`);
    (intervals[owner]??=[]).push([start,plan.finish[task.id]]);
  }
  assert.equal(plan.count,Object.values(plan.assignments).filter(Boolean).length);
}
test('sample baseline preserves every original assignment',()=>{
  const p=sampleProject(),r=recover(p); assert.equal(r.count,8);assert.equal(r.changes,0);assert.equal(affectedTasks(p).size,0);assertFeasible(p,r);
});
test('one-click demo recovers two tasks and explains the unique skill gap',()=>{
  const p=sampleProject();p.members[0].available=false;const r=recover(p);
  assert.equal(r.assignments.t2,'m2');assert.equal(r.assignments.t4,'m3');assert.equal(r.assignments.t5,null);assert.match(r.reasons.t5,/data visualization/);assert.equal(r.count,7);assert.equal(r.changes,2);assertFeasible(p,r);
  assert.deepEqual([...affectedTasks(p)],['t2','t4','t5','t6','t8']);
});
test('all required skills must match, not just one',()=>{
  const p=sampleProject();p.tasks=[{...p.tasks[0],skills:['react','writing'],assignee:null,dependencies:[]}];const r=recover(p);assert.equal(r.count,0);assert.match(r.reasons.t1,/all required skills/);
});
test('a shared hour budget is enforced across multiple tasks',()=>{
  const p=sampleProject();p.members=[{...p.members[0],hours:6}];p.tasks=[{...p.tasks[0],skills:['react'],effort:4,assignee:'m1',dependencies:[]},{...p.tasks[1],skills:['react'],effort:4,assignee:'m1',dependencies:[]}];
  const r=recover(p);assert.equal(r.count,1);assert.ok(Object.values(r.reasons).some(s=>s.includes('remaining')));assertFeasible(p,r);
});
test('blocked prerequisites block all downstream work',()=>{
  const p=sampleProject();p.tasks=[{...p.tasks[0],skills:['unobtainium']},{...p.tasks[1],dependencies:['t1']}];const r=recover(p);assert.equal(r.count,0);assert.match(r.reasons.t2,/dependency/);assertFeasible(p,r);
});
test('impossible and past deadlines cannot produce a reassignment',()=>{
  const p=sampleProject();p.tasks=[{...p.tasks[0],deadline:p.startDate,effort:5}];let r=recover(p);assert.equal(r.count,0);assert.match(r.reasons.t1,/deadline/);
  p.tasks[0].deadline='2000-01-01';r=recover(p);assert.equal(r.count,0);
});
test('dependencies and daily work limits combine correctly',()=>{
  const p=sampleProject();p.tasks=[{...p.tasks[0],effort:4,deadline:p.startDate},{...p.tasks[1],effort:1,deadline:p.startDate}];const r=recover(p);assert.equal(r.count,1);assert.match(r.reasons.t2,/deadline/);assertFeasible(p,r);
});
test('adding a qualified teammate resolves the blocked demo task',()=>{
  const p=sampleProject();p.members[0].available=false;p.members.push({id:'new',name:'Taylor',skills:['data visualization'],hours:4,available:true});const r=recover(p);assert.equal(r.count,8);assert.equal(r.assignments.t5,'new');assertFeasible(p,r);
});
test('unassigned tasks can be recovered and zero-hour members cannot receive work',()=>{
  const p=sampleProject();p.tasks=[{...p.tasks[0],assignee:null}];p.members[3].hours=0;const r=recover(p);assert.equal(r.assignments.t1,'m2');assertFeasible(p,r);
});
test('no teammates, no tasks, and all unavailable are handled',()=>{
  const p=sampleProject();p.members=[];assert.equal(recover(p).count,0);p.tasks=[];assert.equal(recover(p).count,0);
  const q=sampleProject();q.members.forEach(m=>m.available=false);assert.equal(recover(q).count,0);
});
test('cyclic and missing dependencies are rejected before calculation',()=>{
  const p=sampleProject();p.tasks[0].dependencies=['t8'];assert.throws(()=>topological(p.tasks),/cycle/);assert.equal(validateProject(p),false);
  p.tasks[0].dependencies=['missing'];assert.throws(()=>recover(p),/existing/);
});
test('browser storage validation rejects malformed and oversized projects',()=>{
  assert.equal(validateProject(sampleProject()),true);assert.equal(validateProject(null),false);assert.equal(validateProject({version:2}),false);
  const p=sampleProject();p.tasks[0].effort=-1;assert.equal(validateProject(p),false);p.tasks[0].effort=Infinity;assert.equal(validateProject(p),false);
  const q=sampleProject();q.members.push(q.members[0]);assert.equal(validateProject(q),false);
});
test('normalization is case insensitive and deduplicates skills',()=>assert.deepEqual(normalizeSkills(' React, DESIGN, react, ,Testing '),['react','design','testing']));
test('planner is deterministic and never mutates original data',()=>{
  const p=sampleProject();p.members[0].available=false;const snapshot=JSON.stringify(p),a=recover(p),b=recover(p);assert.deepEqual(a.assignments,b.assignments);assert.equal(JSON.stringify(p),snapshot);
});
test('capacity and schedule invariants hold over varied local scenarios',()=>{
  for(let seed=0;seed<35;seed++) {const p=sampleProject();p.members.forEach((m,i)=>{m.hours=(seed*7+i*5)%23;m.available=(seed+i)%5!==0});p.tasks.forEach((t,i)=>{t.effort=((seed+i)%6+1)/2;});assertFeasible(p,recover(p));}
});
