/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { MonteCarloHistogram } from '../montecarlo/MonteCarloHistogram';
import { TornadoDiagram } from '../montecarlo/TornadoDiagram';
import { GanttChart, GanttTask } from '../schedule/GanttChart';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const histogramBins = [
  { min: 80, max: 90, count: 5, cumulativePercent: 10 },
  { min: 90, max: 100, count: 15, cumulativePercent: 40 },
  { min: 100, max: 110, count: 20, cumulativePercent: 80 },
  { min: 110, max: 120, count: 8, cumulativePercent: 96 },
  { min: 120, max: 130, count: 2, cumulativePercent: 100 },
];

const sensitivityData = [
  { taskId: 't1', taskName: 'Foundation Work', correlationCoefficient: 0.85, rank: 1 },
  { taskId: 't2', taskName: 'Framing', correlationCoefficient: 0.62, rank: 2 },
  { taskId: 't3', taskName: 'Electrical', correlationCoefficient: -0.35, rank: 3 },
  { taskId: 't4', taskName: 'Painting', correlationCoefficient: 0.15, rank: 4 },
];

const ganttTasks: GanttTask[] = [
  {
    id: 'task-1',
    name: 'Planning Phase',
    status: 'completed',
    priority: 'high',
    startDate: '2025-01-01',
    endDate: '2025-01-15',
    progressPercentage: 100,
  },
  {
    id: 'task-2',
    name: 'Design Phase',
    status: 'in_progress',
    priority: 'medium',
    startDate: '2025-01-16',
    endDate: '2025-02-15',
    progressPercentage: 60,
    dependency: 'task-1',
  },
  {
    id: 'task-3',
    name: 'Development',
    status: 'pending',
    priority: 'urgent',
    startDate: '2025-02-16',
    endDate: '2025-04-15',
    progressPercentage: 0,
    dependency: 'task-2',
  },
  {
    id: 'task-1-1',
    name: 'Sub-task: Requirements',
    status: 'completed',
    startDate: '2025-01-01',
    endDate: '2025-01-10',
    progressPercentage: 100,
    parentTaskId: 'task-1',
  },
];

// ===================================================================
// MonteCarloHistogram
// ===================================================================

describe('MonteCarloHistogram', () => {
  it('renders empty state when no data', () => {
    render(<MonteCarloHistogram histogram={[]} p50={0} p80={0} p90={0} />);
    expect(screen.getByText('No histogram data available.')).toBeInTheDocument();
  });

  it('renders SVG element with correct viewBox', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 740 320');
  });

  it('renders histogram bars for each bin', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    const bars = container.querySelectorAll('rect[fill="#818cf8"]');
    expect(bars.length).toBe(histogramBins.length);
  });

  it('renders percentile lines (P50, P80, P90)', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    // Each percentile has a dashed line + label text
    const allText = container.querySelectorAll('text');
    const textContent = Array.from(allText).map((t) => t.textContent);
    expect(textContent.some((t) => t?.includes('P50'))).toBe(true);
    expect(textContent.some((t) => t?.includes('P80'))).toBe(true);
    expect(textContent.some((t) => t?.includes('P90'))).toBe(true);
  });

  it('renders S-curve polyline', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeTruthy();
    expect(polyline!.getAttribute('stroke')).toBe('#f97316');
  });

  it('renders S-curve dots for each bin', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    const dots = container.querySelectorAll('circle[fill="#f97316"]');
    expect(dots.length).toBe(histogramBins.length);
  });

  it('renders Y-axis labels (Frequency and Cumulative %)', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts).toContain('Frequency');
    expect(texts).toContain('Cumulative %');
  });

  it('renders X-axis title', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts).toContain('Duration (days)');
  });

  it('shows tooltip on bar hover', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    const bars = container.querySelectorAll('rect[fill="#818cf8"]');
    fireEvent.mouseEnter(bars[2]); // hover 3rd bar (100-110, count: 20)

    expect(screen.getByText(/100 - 110 days/)).toBeInTheDocument();
    expect(screen.getByText(/Count: 20/)).toBeInTheDocument();
    expect(screen.getByText(/Cumulative: 80.0%/)).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave from SVG', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    const bars = container.querySelectorAll('rect[fill="#818cf8"]');
    fireEvent.mouseEnter(bars[0]);
    expect(screen.getByText(/80 - 90 days/)).toBeInTheDocument();

    const svg = container.querySelector('svg')!;
    fireEvent.mouseLeave(svg);
    expect(screen.queryByText(/80 - 90 days/)).not.toBeInTheDocument();
  });

  it('renders legend items', () => {
    render(<MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />);
    // "Frequency" appears both in Y-axis title and legend
    expect(screen.getAllByText('Frequency').length).toBeGreaterThanOrEqual(1);
    // "Cumulative %" appears both in Y-axis title and legend
    expect(screen.getAllByText('Cumulative %').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('P50').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('P80').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('P90').length).toBeGreaterThanOrEqual(1);
  });

  it('renders grid lines', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    // Grid lines are rendered as line elements with stroke="#e5e7eb"
    const gridLines = container.querySelectorAll('line[stroke="#e5e7eb"]');
    expect(gridLines.length).toBeGreaterThan(0);
  });

  it('highlights hovered bar with full opacity', () => {
    const { container } = render(
      <MonteCarloHistogram histogram={histogramBins} p50={95} p80={110} p90={120} />,
    );
    const bars = container.querySelectorAll('rect[fill="#818cf8"]');
    // Before hover, bars have 0.75 opacity
    expect(bars[0].getAttribute('opacity')).toBe('0.75');
    // After hover, the hovered bar should have opacity 1
    fireEvent.mouseEnter(bars[0]);
    // Re-query since React re-renders
    const updatedBars = container.querySelectorAll('rect[fill="#818cf8"]');
    expect(updatedBars[0].getAttribute('opacity')).toBe('1');
  });

  it('handles single-bin histogram', () => {
    const singleBin = [{ min: 100, max: 110, count: 50, cumulativePercent: 100 }];
    const { container } = render(
      <MonteCarloHistogram histogram={singleBin} p50={105} p80={108} p90={109} />,
    );
    const bars = container.querySelectorAll('rect[fill="#818cf8"]');
    expect(bars.length).toBe(1);
  });
});

// ===================================================================
// TornadoDiagram
// ===================================================================

describe('TornadoDiagram', () => {
  it('renders empty state when no data', () => {
    render(<TornadoDiagram data={[]} />);
    expect(screen.getByText('No sensitivity data available.')).toBeInTheDocument();
  });

  it('renders SVG element', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders bars for each entry', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    // Each entry has a rect (bar) inside a <g>
    const rects = container.querySelectorAll('rect[rx="3"]');
    expect(rects.length).toBe(sensitivityData.length);
  });

  it('renders task names as labels', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts).toContain('Foundation Work');
    expect(texts).toContain('Framing');
    expect(texts).toContain('Electrical');
    expect(texts).toContain('Painting');
  });

  it('renders correlation values on bars', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts).toContain('0.85');
    expect(texts).toContain('0.62');
    expect(texts).toContain('-0.35');
    expect(texts).toContain('0.15');
  });

  it('uses blue for positive and red for negative correlations', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    const rects = container.querySelectorAll('rect[rx="3"]');
    // Sorted by absolute value: Foundation(0.85), Framing(0.62), Electrical(-0.35), Painting(0.15)
    expect(rects[0].getAttribute('fill')).toBe('#3b82f6'); // positive
    expect(rects[1].getAttribute('fill')).toBe('#3b82f6'); // positive
    expect(rects[2].getAttribute('fill')).toBe('#ef4444'); // negative
    expect(rects[3].getAttribute('fill')).toBe('#3b82f6'); // positive
  });

  it('sorts bars by absolute correlation descending', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    // Task name labels should appear in descending order of |correlation|
    const taskTexts = Array.from(container.querySelectorAll('text'))
      .map((t) => t.textContent)
      .filter((t) => sensitivityData.some((d) => d.taskName === t));
    expect(taskTexts[0]).toBe('Foundation Work');
    expect(taskTexts[1]).toBe('Framing');
    expect(taskTexts[2]).toBe('Electrical');
    expect(taskTexts[3]).toBe('Painting');
  });

  it('renders center axis line', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    // Center line has stroke="#d1d5db"
    const centerLine = container.querySelector('line[stroke="#d1d5db"]');
    expect(centerLine).toBeTruthy();
  });

  it('renders X-axis title', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts).toContain('Correlation Coefficient');
  });

  it('renders legend', () => {
    render(<TornadoDiagram data={sensitivityData} />);
    expect(screen.getByText('Positive correlation (delays project)')).toBeInTheDocument();
    expect(screen.getByText('Negative correlation')).toBeInTheDocument();
  });

  it('highlights bar on hover', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    const groups = container.querySelectorAll('g');
    // Find the g that contains the first bar (Foundation Work)
    const barGroup = Array.from(groups).find((g) => {
      const texts = g.querySelectorAll('text');
      return Array.from(texts).some((t) => t.textContent === 'Foundation Work');
    });
    expect(barGroup).toBeTruthy();
    fireEvent.mouseEnter(barGroup!);

    // After hover, the bar rect should have opacity=1
    const rect = barGroup!.querySelector('rect[rx="3"]');
    expect(rect?.getAttribute('opacity')).toBe('1');
  });

  it('truncates long task names to 24 characters', () => {
    const longNameData = [
      { taskId: 't1', taskName: 'Very Long Task Name That Exceeds Twenty Four Characters', correlationCoefficient: 0.5, rank: 1 },
    ];
    const { container } = render(<TornadoDiagram data={longNameData} />);
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent);
    expect(texts.some((t) => t?.includes('...'))).toBe(true);
    expect(texts.some((t) => t === 'Very Long Task Name That Exceeds Twenty Four Characters')).toBe(false);
  });

  it('renders X-axis grid lines', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    // Grid lines have stroke="#f3f4f6"
    const gridLines = container.querySelectorAll('line[stroke="#f3f4f6"]');
    expect(gridLines.length).toBeGreaterThan(0);
  });

  it('calculates dynamic SVG height based on data length', () => {
    const { container } = render(<TornadoDiagram data={sensitivityData} />);
    const svg = container.querySelector('svg');
    const viewBox = svg!.getAttribute('viewBox')!;
    const height = parseInt(viewBox.split(' ')[3]);
    // 4 entries * 32 + 48 = 176, but min is 180
    expect(height).toBeGreaterThanOrEqual(180);
  });
});

// ===================================================================
// GanttChart
// ===================================================================

describe('GanttChart', () => {
  it('renders empty state when no tasks', () => {
    render(<GanttChart tasks={[]} />);
    expect(screen.getByText('No tasks to display.')).toBeInTheDocument();
  });

  it('renders task names in table', () => {
    render(<GanttChart tasks={ganttTasks} />);
    // Task names may appear in both table and timeline bar labels
    expect(screen.getAllByText('Planning Phase').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Design Phase').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Development').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sub-task: Requirements').length).toBeGreaterThanOrEqual(1);
  });

  it('renders schedule name when provided', () => {
    render(<GanttChart tasks={ganttTasks} scheduleName="Main Schedule" />);
    expect(screen.getByText('Main Schedule')).toBeInTheDocument();
  });

  it('renders task count badge', () => {
    render(<GanttChart tasks={ganttTasks} scheduleName="Test" />);
    expect(screen.getByText('4 tasks')).toBeInTheDocument();
  });

  it('renders Add Task button when onAddTask provided', () => {
    const onAddTask = vi.fn();
    render(<GanttChart tasks={ganttTasks} scheduleName="Test" onAddTask={onAddTask} />);
    const btn = screen.getByText('Add Task');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAddTask).toHaveBeenCalledTimes(1);
  });

  it('does not render Add Task button when onAddTask not provided', () => {
    render(<GanttChart tasks={ganttTasks} scheduleName="Test" />);
    expect(screen.queryByText('Add Task')).not.toBeInTheDocument();
  });

  it('renders WBS numbers', () => {
    render(<GanttChart tasks={ganttTasks} />);
    // Top-level gets "1", "2", "3"; child gets "1.1"
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('1.1')).toBeInTheDocument();
  });

  it('renders progress percentages', () => {
    render(<GanttChart tasks={ganttTasks} />);
    // Percentage text may appear in table rows and in tooltips
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('60%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badges', () => {
    render(<GanttChart tasks={ganttTasks} />);
    expect(screen.getAllByText('Done').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    render(<GanttChart tasks={ganttTasks} />);
    expect(screen.getByText('WBS')).toBeInTheDocument();
    expect(screen.getByText('Task Name')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
  });

  it('calls onTaskClick when task row is clicked', () => {
    const onTaskClick = vi.fn();
    render(<GanttChart tasks={ganttTasks} onTaskClick={onTaskClick} />);
    // Task name may appear in multiple places; click the first one (table row)
    fireEvent.click(screen.getAllByText('Design Phase')[0]);
    expect(onTaskClick).toHaveBeenCalledTimes(1);
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-2', name: 'Design Phase' }));
  });

  it('renders legend with status labels', () => {
    render(<GanttChart tasks={ganttTasks} />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Not Started')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders Today indicator in legend', () => {
    render(<GanttChart tasks={ganttTasks} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders Dependency legend item', () => {
    render(<GanttChart tasks={ganttTasks} />);
    expect(screen.getByText('Dependency')).toBeInTheDocument();
  });

  it('renders Critical Path legend when critical IDs provided', () => {
    render(<GanttChart tasks={ganttTasks} criticalPathTaskIds={['task-1']} />);
    expect(screen.getByText('Critical Path')).toBeInTheDocument();
  });

  it('does not render Critical Path legend when no critical IDs', () => {
    render(<GanttChart tasks={ganttTasks} />);
    expect(screen.queryByText('Critical Path')).not.toBeInTheDocument();
  });

  it('renders Baseline legend when baseline tasks provided', () => {
    const baselines = [{ taskId: 'task-1', startDate: '2025-01-01', endDate: '2025-01-20' }];
    render(<GanttChart tasks={ganttTasks} baselineTasks={baselines} />);
    expect(screen.getByText('Baseline')).toBeInTheDocument();
  });

  it('does not render Baseline legend when no baseline tasks', () => {
    render(<GanttChart tasks={ganttTasks} />);
    expect(screen.queryByText('Baseline')).not.toBeInTheDocument();
  });

  it('renders formatted dates for tasks', () => {
    render(<GanttChart tasks={ganttTasks} />);
    // Jan 1 should appear for Planning Phase start
    const dateTexts = screen.getAllByText(/Jan/);
    expect(dateTexts.length).toBeGreaterThan(0);
  });

  it('renders SVG for dependency arrows', () => {
    const { container } = render(<GanttChart tasks={ganttTasks} />);
    const svgElements = container.querySelectorAll('svg');
    // At least one SVG for the dependency arrows overlay
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('renders arrowhead marker definition', () => {
    const { container } = render(<GanttChart tasks={ganttTasks} />);
    const marker = container.querySelector('marker#arrowhead');
    expect(marker).toBeTruthy();
  });

  it('renders dependency paths for tasks with dependencies', () => {
    const { container } = render(<GanttChart tasks={ganttTasks} />);
    // task-2 depends on task-1, task-3 depends on task-2
    const paths = container.querySelectorAll('path[stroke="#9ca3af"]');
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it('shows dash for tasks without dates', () => {
    const taskNoDate: GanttTask[] = [
      { id: 'nd1', name: 'No Date Task', status: 'pending' },
    ];
    render(<GanttChart tasks={taskNoDate} />);
    // Should show em-dashes for missing dates
    const dashes = screen.getAllByText('\u2014');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('handles tasks with no parent correctly (all top-level)', () => {
    const flatTasks: GanttTask[] = [
      { id: 'a', name: 'Task A', status: 'pending', startDate: '2025-03-01', endDate: '2025-03-10' },
      { id: 'b', name: 'Task B', status: 'completed', startDate: '2025-03-05', endDate: '2025-03-15' },
    ];
    render(<GanttChart tasks={flatTasks} />);
    // Task names may appear in both table and timeline bars
    expect(screen.getAllByText('Task A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Task B').length).toBeGreaterThanOrEqual(1);
  });

  it('renders month labels in the timeline header', () => {
    const { container } = render(<GanttChart tasks={ganttTasks} />);
    // Look for month labels like "Jan 2025", "Feb 2025"
    const monthElements = container.querySelectorAll('[class*="uppercase"]');
    const monthTexts = Array.from(monthElements).map((e) => e.textContent?.trim()).filter(Boolean);
    expect(monthTexts.some((t) => t?.includes('Jan'))).toBe(true);
  });
});
