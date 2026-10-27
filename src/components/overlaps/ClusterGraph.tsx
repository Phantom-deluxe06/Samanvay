'use client';
import * as React from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import type { Core, ElementDefinition, StylesheetStyle } from 'cytoscape';
import type { CaseView, L2Edge } from '@/api/types';
import type { Institution, RiskBreakdown } from '@/lib/types';
import { BUREAU_SHORT, BUREAU_SOLID, bureauKind } from '@/lib/constants';

export interface ClusterGraphProps {
  institution: Institution;
  risk: RiskBreakdown;
  cases: CaseView[];
  extraCases?: CaseView[];
  l2Edges: L2Edge[];
  onSelectCase?: (caseId: string) => void;
  height?: number;
  compact?: boolean;
}

const stylesheet: StylesheetStyle[] = [
  {
    selector: 'node.inst',
    style: {
      'background-color': '#0F2A52', shape: 'round-rectangle', width: 'label', height: 'label', padding: '14px',
      label: 'data(label)', color: '#fff', 'font-size': 11, 'font-weight': 'bold', 'text-wrap': 'wrap', 'text-max-width': '170px',
      'text-valign': 'center', 'text-halign': 'center', 'border-width': 3, 'border-color': 'data(riskColor)',
    },
  },
  {
    selector: 'node.case',
    style: {
      'background-color': 'data(color)', shape: 'ellipse', width: 74, height: 74,
      label: 'data(label)', color: '#fff', 'font-size': 9.5, 'font-weight': 'bold', 'text-wrap': 'wrap', 'text-max-width': '70px',
      'text-valign': 'center', 'text-halign': 'center', 'border-width': 2, 'border-color': '#ffffff',
    },
  },
  { selector: 'node.case.overdue', style: { 'border-width': 4, 'border-color': '#C0392B' } },
  { selector: 'node.case.disposed', style: { opacity: 0.55, 'border-style': 'dashed', 'border-color': '#5B6B82' } },
  { selector: 'node:selected', style: { 'overlay-color': '#F39C34', 'overlay-opacity': 0.25, 'overlay-padding': 6 } },
  { selector: 'edge.link', style: { width: 2, 'line-color': '#B9C7DA', 'curve-style': 'straight' } },
  {
    selector: 'edge.l2',
    style: {
      width: 2.5, 'line-color': '#F39C34', 'line-style': 'dashed', 'curve-style': 'unbundled-bezier', 'control-point-distances': [40], 'control-point-weights': [0.5],
      label: 'data(label)', 'font-size': 10, 'font-weight': 'bold', color: '#A35A0A', 'text-background-color': '#FFF4E5', 'text-background-opacity': 1, 'text-background-padding': '3px',
      'text-background-shape': 'roundrectangle',
    },
  },
];

function riskColor(score: number) {
  return score >= 60 ? '#E74C3C' : score >= 30 ? '#F5B041' : '#58D68D';
}

export default function ClusterGraph({ institution, risk, cases, extraCases = [], l2Edges, onSelectCase, height = 440, compact }: ClusterGraphProps) {
  const cyRef = React.useRef<Core | null>(null);
  const all = React.useMemo(() => [...cases, ...extraCases.filter((e) => !cases.some((c) => c.caseId === e.caseId))], [cases, extraCases]);

  const elements = React.useMemo<ElementDefinition[]>(() => {
    const r = compact ? 120 : 175;
    const els: ElementDefinition[] = [
      {
        data: { id: 'inst', label: `${institution.name}\n${institution.aicteId}\nRisk: ${risk.label} (${risk.score})`, riskColor: riskColor(risk.score) },
        position: { x: 0, y: 0 }, classes: 'inst', selectable: false,
      },
    ];
    all.forEach((c, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / all.length;
      const disposed = c.status === 'Disposed';
      els.push({
        data: { id: c.caseId, label: `${c.caseId}\n${BUREAU_SHORT[c.bureau]}${c.overdue ? '\nOVERDUE' : disposed ? '\ndisposed' : ''}`, color: BUREAU_SOLID[bureauKind(c.bureau)] },
        position: { x: Math.cos(angle) * r * 1.35, y: Math.sin(angle) * r },
        classes: `case${c.overdue ? ' overdue' : ''}${disposed ? ' disposed' : ''}`,
      });
      els.push({ data: { id: `e-${c.caseId}`, source: 'inst', target: c.caseId }, classes: 'link', selectable: false });
    });
    for (const e of l2Edges) {
      if (!all.some((c) => c.caseId === e.a) || !all.some((c) => c.caseId === e.b)) continue;
      els.push({ data: { id: `l2-${e.a}-${e.b}`, source: e.a, target: e.b, label: `same issue? ${e.similarity.toFixed(2)}` }, classes: 'l2', selectable: false });
    }
    return els;
  }, [all, institution, risk, l2Edges, compact]);

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.fit(undefined, 30);
  }, [elements]);

  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Graph: ${institution.name} with ${all.length} linked cases${l2Edges.length ? ` and ${l2Edges.length} same-issue link(s)` : ''}. Use the list beside the graph for keyboard access.`}>
      <CytoscapeComponent
        elements={elements}
        stylesheet={stylesheet}
        layout={{ name: 'preset', fit: true, padding: 30 }}
        style={{ width: '100%', height: '100%' }}
        minZoom={0.4}
        maxZoom={2}
        wheelSensitivity={0.2}
        cy={(cy: Core) => {
          if (cyRef.current === cy) return;
          cyRef.current = cy;
          cy.on('tap', 'node.case', (evt) => onSelectCase?.(evt.target.id()));
          cy.on('mouseover', 'node.case', () => { (cy.container() as HTMLElement).style.cursor = 'pointer'; });
          cy.on('mouseout', 'node.case', () => { (cy.container() as HTMLElement).style.cursor = 'default'; });
          setTimeout(() => cy.fit(undefined, 30), 50);
        }}
      />
    </div>
  );
}
