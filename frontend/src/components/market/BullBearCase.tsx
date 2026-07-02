import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface BullBearCaseProps {
  bullCase: string[];
  bearCase: string[];
}

export default function BullBearCase({ bullCase, bearCase }: BullBearCaseProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Bull Case */}
      <div className="card-accent-success p-5">
        <h3 className="text-success font-bold flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" />
          Bull Case
        </h3>
        <ul className="space-y-3">
          {Array.isArray(bullCase) ? bullCase.map((point, idx) => (
            <li key={idx} className="flex gap-2 text-sm text-text-main leading-relaxed">
              <span className="text-success shrink-0">•</span>
              <span>{point}</span>
            </li>
          )) : <li className="text-sm text-text-muted">No data</li>}
        </ul>
      </div>

      {/* Bear Case */}
      <div className="card-accent-danger p-5">
        <h3 className="text-danger font-bold flex items-center gap-2 mb-4">
          <TrendingDown className="w-5 h-5" />
          Bear Case
        </h3>
        <ul className="space-y-3">
          {Array.isArray(bearCase) ? bearCase.map((point, idx) => (
            <li key={idx} className="flex gap-2 text-sm text-text-main leading-relaxed">
              <span className="text-danger shrink-0">•</span>
              <span>{point}</span>
            </li>
          )) : <li className="text-sm text-text-muted">No data</li>}
        </ul>
      </div>
    </div>
  );
}
