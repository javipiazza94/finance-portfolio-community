import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, DollarSign, Percent } from 'lucide-react';
import { clsx } from 'clsx';
import { buyAsset } from '@/lib/api';

interface LiquidityModalProps {
  onClose: () => void;
  onAdded: () => void;
}

export function LiquidityModal({ onClose, onAdded }: LiquidityModalProps) {
  const [currency, setCurrency] = useState('EUR');
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currencies = ['EUR', 'USD', 'GBP', 'CHF', 'JPY'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    setLoading(true);
    setError('');

    const interestText = interestRate ? ` (${interestRate}% interés)` : '';
    const assetName = `Liquidez ${currency}${interestText}`;
    
    // Construct ticker correctly so it's matched by 'cash' in the frontend getMappedType
    const ticker = `CASH_${currency}`;

    try {
      await buyAsset({
        ticker,
        asset_name: assetName,
        units: parseFloat(amount),
        price: 1.0,
        date: new Date().toISOString().split('T')[0]
      });

      onAdded();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Error al añadir liquidez');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-bg-card border border-border/40 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-5 border-b border-border/40 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Añadir Liquidez</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/5 rounded-lg text-text-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">Divisa</label>
            <div className="flex gap-2">
              {currencies.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={clsx(
                    "flex-1 py-2 text-sm font-medium rounded-lg transition-colors",
                    currency === c 
                      ? "bg-primary text-white" 
                      : "bg-white/5 text-text-muted hover:bg-white/10"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Cantidad</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <DollarSign size={16} />
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-bg-base border border-border/50 rounded-xl py-2 pl-9 pr-3 text-text-primary focus:outline-none focus:border-primary transition-colors"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Tipo de Interés (Opcional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Percent size={16} />
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full bg-bg-base border border-border/50 rounded-xl py-2 pl-9 pr-3 text-text-primary focus:outline-none focus:border-primary transition-colors"
                  placeholder="Ej: 3.5"
                />
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !amount}
              className="w-full py-2.5 rounded-xl bg-success hover:bg-success/80 text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Añadir Liquidez'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
