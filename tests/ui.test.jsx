import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,within,waitFor,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import {sampleProject} from '../src/engine.js';
const start=()=>{render(<App/>);return userEvent.setup()};
describe('TeamRescue main interactions',()=>{
  it('loads the realistic sample and generates a complete no-change baseline',async()=>{
    const user=start();expect(screen.getByRole('heading',{name:'Project recovery'})).toBeTruthy();
    await user.click(screen.getByRole('button',{name:'Generate recovery plan'}));
    expect(await screen.findByText('You’re already on a good path.')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('teamrescue.v1')).hasPlan).toBe(true);
  });
  it('runs the one-click demo and compares two recovered assignments plus the blocked task',async()=>{
    const user=start();await user.click(screen.getByRole('button',{name:/Try a demo scenario/}));
    expect(await screen.findByText('7 tasks. One step closer to done.')).toBeTruthy();
    expect(screen.getByRole('switch',{name:'Alex Morgan availability'}).getAttribute('aria-checked')).toBe('false');
    expect(within(screen.getByRole('main')).getByText('No available teammate has all required skills (data visualization).')).toBeTruthy();
    await user.click(within(screen.getByRole('navigation',{name:'Main navigation'})).getByRole('button',{name:'Compare plans',exact:true}));
    const table=within(screen.getByRole('main')).getByRole('table');const design=within(table).getByText('Interface design').closest('tr');
    expect(design.textContent).toContain('Alex Morgan');expect(design.textContent).toContain('Priya Sharma');
    const analytics=within(table).getByText('Analytics charts').closest('tr');expect(analytics.textContent).toContain('Needs intervention');
  });
  it('marks unavailability, highlights direct and dependent tasks, and invalidates stale suggestions',async()=>{
    const user=start();await user.click(screen.getByRole('switch',{name:'Alex Morgan availability'}));
    expect(document.querySelectorAll('.task-node.affected').length).toBe(5);
    await user.click(screen.getByRole('button',{name:'Generate recovery plan'}));await screen.findByText('7 tasks. One step closer to done.');
    await user.click(screen.getByRole('switch',{name:'Alex Morgan availability'}));
    expect(screen.getByRole('button',{name:'Recovery'}).disabled).toBe(true);
    expect(JSON.parse(localStorage.getItem('teamrescue.v1')).hasPlan).toBe(false);
  });
  it('adds a teammate and a dependent task using the actual forms',async()=>{
    const user=start();await user.click(screen.getByRole('button',{name:'Add teammate'}));
    let dialog=screen.getByRole('dialog');await user.type(within(dialog).getByLabelText('Full name'),'Taylor Chen');
    await user.type(within(dialog).getByLabelText('Role'),'Analytics specialist');
    await user.type(within(dialog).getByLabelText(/Skills/),'Data Visualization, React');
    await user.clear(within(dialog).getByLabelText(/Available hours/));await user.type(within(dialog).getByLabelText(/Available hours/),'8');
    await user.click(within(dialog).getByRole('button',{name:'Add teammate'}));
    expect(screen.getByRole('switch',{name:'Taylor Chen availability'})).toBeTruthy();
    await user.click(screen.getByRole('button',{name:'Add task'}));dialog=screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Task name'),'Analytics handoff');
    await user.type(within(dialog).getByLabelText(/Required skills/),'react');
    await user.selectOptions(within(dialog).getByLabelText('Original assignee'),screen.getByRole('option',{name:'Taylor Chen'}).value);
    await user.click(within(dialog).getByLabelText('API integration'));
    await user.click(within(dialog).getByRole('button',{name:'Add task'}));
    const saved=JSON.parse(localStorage.getItem('teamrescue.v1')).project;
    expect(saved.members.at(-1).skills).toEqual(['data visualization','react']);
    expect(saved.tasks.at(-1).dependencies).toEqual(['t3']);expect(saved.tasks.at(-1).title).toBe('Analytics handoff');
  });
  it('rejects a dependency cycle through the task editor',async()=>{
    const user=start();await user.click(screen.getByRole('tab',{name:'Task list'}));
    await user.click(screen.getByRole('button',{name:'Edit Student discovery'}));
    const dialog=screen.getByRole('dialog');await user.click(within(dialog).getByLabelText('Final presentation'));
    await user.click(within(dialog).getByRole('button',{name:'Save changes'}));
    expect(screen.getByRole('alert').textContent).toContain('cannot form a cycle');
  });
  it('persists custom data and recomputes saved recovery on a fresh mount',async()=>{
    const p=sampleProject();p.members[0].available=false;p.name='Saved semester project';
    localStorage.setItem('teamrescue.v1',JSON.stringify({project:p,hasPlan:true}));
    start();expect(screen.getByText('7 tasks. One step closer to done.')).toBeTruthy();
    expect(screen.getAllByText('Saved semester project').length).toBeGreaterThan(0);
  });
  it('recovers safely from corrupted browser storage',()=>{
    localStorage.setItem('teamrescue.v1','{corrupt');start();expect(screen.getByRole('heading',{name:'Project recovery'})).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('teamrescue.v1')).project.tasks.length).toBe(8);
  });
  it('warns when storage is unavailable while leaving the simulator usable',()=>{
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota')});start();
    expect(screen.getByText('Storage unavailable')).toBeTruthy();expect(screen.getByRole('button',{name:'Generate recovery plan'}).disabled).toBe(false);
  });
  it('searches and filters tasks without changing project data',async()=>{
    const user=start();await user.click(screen.getByRole('button',{name:'Project tasks',exact:true}));
    await user.type(screen.getByRole('textbox',{name:'Search tasks'}),'react');
    const table=within(screen.getByRole('main')).getByRole('table');expect(within(table).getAllByRole('row').length).toBe(2);
    expect(within(table).getByText('React dashboard')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('teamrescue.v1')).project.tasks.length).toBe(8);
  });
  it('exports the dedicated recovery report through the print action',async()=>{
    const print=vi.spyOn(window,'print').mockImplementation(()=>{});const user=start();
    await user.click(screen.getByRole('button',{name:/Try a demo scenario/}));await screen.findByText('7 tasks. One step closer to done.');
    await user.click(screen.getByRole('button',{name:'Export plan'}));expect(print).toHaveBeenCalledOnce();
    const report=document.querySelector('.print-plan');expect(report.textContent).toContain('7/8 tasks scheduled');
    expect(report.textContent).toContain('BLOCKED');expect(report.textContent).toContain('data visualization');
  });
  it('confirms sample reset and clears the prior recovery',async()=>{
    const user=start();await user.click(screen.getByRole('switch',{name:'Alex Morgan availability'}));
    await user.click(screen.getByRole('button',{name:'Reset sample'}));expect(screen.getByRole('alertdialog')).toBeTruthy();
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Reset sample'}));
    expect(screen.getByRole('switch',{name:'Alex Morgan availability'}).getAttribute('aria-checked')).toBe('true');
    expect(JSON.parse(localStorage.getItem('teamrescue.v1')).hasPlan).toBe(false);
  });
});
