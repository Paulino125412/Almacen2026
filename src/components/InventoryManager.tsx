import React, { useState, useMemo } from 'react';
import { RollItem, Provider, Article } from '../types';
import { db, addDoc, updateDoc, deleteDoc } from '../firebase';
import { collection, doc } from 'firebase/firestore';
import { Search, Filter, Plus, FileSpreadsheet, Info, Wrench, Trash2, ShieldAlert, ArrowDownUp, X, CheckCircle, RefreshCw } from 'lucide-react';

interface InventoryManagerProps {
  inventory: RollItem[];
  providers: Provider[];
  articles: Article[];
  onRefresh: () => Promise<void>;
  currentOperator: string;
}

export default function InventoryManager({
  inventory,
  providers,
  articles,
  onRefresh,
  currentOperator
}: InventoryManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProviderId, setFilterProviderId] = useState('all');
  const [filterArticleId, setFilterArticleId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form states for creating a new roll
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rollNo, setRollNo] = useState('');
  const [selectedProvId, setSelectedProvId] = useState('');
  const [selectedArtId, setSelectedArtId] = useState('');
  const [initialMeters, setInitialMeters] = useState(100);
  const [lot, setLot] = useState('');
  const [partida, setPartida] = useState('');
  const [tono, setTono] = useState('');

  // Adjustment State
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustedMeters, setAdjustedMeters] = useState<number>(0);
  const [adjustNotes, setAdjustNotes] = useState('');

  // Dynamic config for selected provider
  const activeProviderConfig = useMemo(() => {
    if (!selectedProvId) return null;
    return providers.find(p => p.id === selectedProvId) || null;
  }, [selectedProvId, providers]);

  // Handle provider change during creation
  const handleProviderChange = (provId: string) => {
    setSelectedProvId(provId);
    // Auto filter or pre-select article
    const relevantArticles = articles.filter(a => a.providerId === provId);
    if (relevantArticles.length > 0) {
      setSelectedArtId(relevantArticles[0].id);
    } else {
      setSelectedArtId('');
    }
    // Clear dynamic fields
    setLot('');
    setPartida('');
    setTono('');
    setRollNo('');
  };

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // 1. Text Search (Matches roll number, article name, lot, tono, partida)
      const article = articles.find(a => a.id === item.articleId);
      const articleName = article?.name || '';
      const provider = providers.find(p => p.id === item.providerId);
      const providerName = provider?.name || '';
      const textToSearch = `${item.rollNumber} ${articleName} ${providerName} ${item.lot || ''} ${item.partida || ''} ${item.tono || ''}`.toLowerCase();
      const matchesSearch = textToSearch.includes(searchTerm.toLowerCase());

      // 2. Provider Filter
      const matchesProvider = filterProviderId === 'all' || item.providerId === filterProviderId;

      // 3. Article Filter
      const matchesArticle = filterArticleId === 'all' || item.articleId === filterArticleId;

      // 4. Status Filter
      let matchesStatus = true;
      if (filterStatus === 'available') matchesStatus = item.currentMeters > 0;
      else if (filterStatus === 'sold') matchesStatus = item.currentMeters === 0;

      // 5. Date filter (creation date of roll)
      let matchesDate = true;
      const iDate = item.createdAt.split('T')[0];
      if (startDate && iDate < startDate) matchesDate = false;
      if (endDate && iDate > endDate) matchesDate = false;

      return matchesSearch && matchesProvider && matchesArticle && matchesStatus && matchesDate;
    });
  }, [inventory, searchTerm, filterProviderId, filterArticleId, filterStatus, startDate, endDate, articles, providers]);

  // Export Inventory list to Excel (CSV)
  const handleExportExcel = () => {
    if (filteredInventory.length === 0) {
      alert('No hay registros filtrados para exportar');
      return;
    }

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'Nº Rollo,Artículo,Proveedor,Lote,Partida,Tono,Mts Iniciales,Mts Actuales,Estado,Fecha de Ingreso\n';

    filteredInventory.forEach(item => {
      const art = articles.find(a => a.id === item.articleId)?.name || '-';
      const prov = providers.find(p => p.id === item.providerId)?.name || '-';
      const statusLabel = item.currentMeters > 0 ? 'DISPONIBLE' : 'AGOTADO';
      const formattedDate = new Date(item.createdAt).toLocaleDateString('es-PE');

      const row = [
        `"${item.rollNumber}"`,
        `"${art}"`,
        `"${prov}"`,
        `"${item.lot || '-'}"`,
        `"${item.partida || '-'}"`,
        `"${item.tono || '-'}"`,
        item.initialMeters,
        item.currentMeters,
        `"${statusLabel}"`,
        `"${formattedDate}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_telas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit new roll registration
  const handleAddRollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvId) {
      setError('Por favor elija un proveedor');
      return;
    }
    if (!selectedArtId) {
      setError('Por favor elija un artículo de tela');
      return;
    }
    if (initialMeters <= 0) {
      setError('La cantidad en metros debe ser mayor a cero');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newId = `roll-${Date.now()}`;
      
      // Determine what values are required based on provider config
      const finalRollNo = (activeProviderConfig?.hasRollNo ?? true) ? rollNo.trim() : `R-AUTO-${Math.floor(1000 + Math.random() * 9000)}`;
      const finalLot = activeProviderConfig?.hasLot ? lot.trim() : '';
      const finalPartida = activeProviderConfig?.hasPartida ? partida.trim() : '';
      const finalTono = activeProviderConfig?.hasTono ? tono.trim() : '';

      if ((activeProviderConfig?.hasRollNo ?? true) && !finalRollNo) {
        throw new Error('El proveedor requiere ingresar un número de rollo.');
      }

      // Check if roll number already exists in inventory
      const duplicate = inventory.find(i => i.rollNumber.toLowerCase() === finalRollNo.toLowerCase());
      if (duplicate && (activeProviderConfig?.hasRollNo ?? true)) {
        throw new Error(`Ya existe un rollo registrado con el número "${finalRollNo}"`);
      }

      const rollData: Omit<RollItem, 'id'> & { appVersion: string } = {
        rollNumber: finalRollNo || `ROLL-${Date.now()}`,
        articleId: selectedArtId,
        providerId: selectedProvId,
        initialMeters: Number(initialMeters),
        currentMeters: Number(initialMeters),
        lot: finalLot,
        partida: finalPartida,
        tono: finalTono,
        status: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        appVersion: '2.6r'
      };

      // Add to firestore
      const docRef = doc(db, 'inventory', newId);
      await updateDoc(docRef, rollData as any).catch(async () => {
        // Fallback if updateDoc fails (doesn't exist), we setDoc
        const { setDoc } = await import('firebase/firestore');
        await setDoc(docRef, rollData);
      });

      await onRefresh();
      
      // Reset form
      setRollNo('');
      setLot('');
      setPartida('');
      setTono('');
      setInitialMeters(100);
      setShowAddForm(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al registrar el rollo');
    } finally {
      setLoading(false);
    }
  };

  // Submit manual stock adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingId) return;

    const roll = inventory.find(r => r.id === adjustingId);
    if (!roll) return;

    if (adjustedMeters < 0) {
      alert('Los metros actuales no pueden ser menores a 0');
      return;
    }

    setLoading(true);
    try {
      const difference = adjustedMeters - roll.currentMeters;
      const status = adjustedMeters === 0 ? 'sold' : 'available';

      await updateDoc(doc(db, 'inventory', adjustingId), {
        currentMeters: Number(adjustedMeters),
        status,
        updatedAt: new Date().toISOString()
      });

      await onRefresh();
      setAdjustingId(null);
      setAdjustNotes('');
    } catch (err) {
      console.error(err);
      alert('Error al ajustar el inventario');
    } finally {
      setLoading(false);
    }
  };

  // Deletion Modal States for Rolls
  const [deleteTargetRoll, setDeleteTargetRoll] = useState<RollItem | null>(null);
  const [isDeletingRoll, setIsDeletingRoll] = useState(false);
  const [deleteRollError, setDeleteRollError] = useState<string | null>(null);
  const [deleteRollSuccess, setDeleteRollSuccess] = useState<string | null>(null);

  const initiateDeleteRoll = (roll: RollItem) => {
    setDeleteRollError(null);
    setDeleteRollSuccess(null);
    setDeleteTargetRoll(roll);
  };

  const handleConfirmDeleteRoll = async () => {
    if (!deleteTargetRoll) return;
    setIsDeletingRoll(true);
    setDeleteRollError(null);

    try {
      await deleteDoc(doc(db, 'inventory', deleteTargetRoll.id));
      
      await onRefresh();
      setDeleteRollSuccess(`El rollo "${deleteTargetRoll.rollNumber}" se eliminó de manera permanente.`);
      setTimeout(() => {
        setDeleteTargetRoll(null);
        setDeleteRollSuccess(null);
      }, 2500);
    } catch (err) {
      console.error("Roll delete failed:", err);
      setDeleteRollError(err instanceof Error ? err.message : 'Error al procesar la eliminación del rollo.');
    } finally {
      setIsDeletingRoll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-app-surface p-4 rounded-lg border border-app-border shadow-xs">
        <div className="flex items-center gap-2">
          <Info size={15} className="text-app-text/50" />
          <p className="text-xs text-app-text/60 font-medium">
            Filtre, audite y agregue rollos de tela. Al seleccionar proveedor se configuran dinámicamente los campos requeridos.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (providers.length > 0) handleProviderChange(providers[0].id);
            }}
            className="px-4 py-1.5 bg-app-primary hover:bg-app-primary/90 text-white rounded text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs uppercase tracking-wider"
            id="btn-toggle-add-roll"
          >
            <Plus size={14} />
            {showAddForm ? 'Cerrar Registro' : 'Registrar Ingreso de Rollo'}
          </button>
        </div>
      </div>

      {/* Conditionally rendered register/add form */}
      {showAddForm && (
        <div className="ticket-perforated p-5 shadow-sm">
          <h3 className="text-xs font-bold text-app-text/60 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Plus size={14} className="text-app-text/45" />
            Ingreso de nuevo rollo textil al almacén
          </h3>
          
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-400 rounded mb-4 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleAddRollSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 1. Provider */}
            <div>
              <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">1. Seleccionar Proveedor *</label>
              <select
                required
                value={selectedProvId}
                onChange={e => handleProviderChange(e.target.value)}
                className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary focus:outline-hidden font-medium"
                id="add-roll-prov"
              >
                <option value="">-- Seleccione Proveedor --</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Article */}
            <div>
              <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">2. Artículo (Tela) *</label>
              <select
                required
                value={selectedArtId}
                onChange={e => setSelectedArtId(e.target.value)}
                className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary focus:outline-hidden font-medium"
                id="add-roll-art"
              >
                <option value="">-- Seleccione Artículo --</option>
                {articles
                  .filter(a => !selectedProvId || a.providerId === selectedProvId)
                  .map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
              </select>
            </div>

            {/* 3. Meters */}
            <div>
              <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">3. Cantidad en Metros *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={initialMeters}
                onChange={e => setInitialMeters(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-app-border rounded text-xs focus:ring-1 focus:ring-app-primary focus:outline-hidden bg-app-surface text-app-text font-mono font-medium"
                id="add-roll-meters"
              />
            </div>

            {/* Dynamic field: Roll Number */}
            {(!activeProviderConfig || (activeProviderConfig.hasRollNo ?? true)) ? (
              <div>
                <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Número de Rollo / Etiqueta *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. R-512"
                  value={rollNo}
                  onChange={e => setRollNo(e.target.value)}
                  className="w-full px-3 py-1.5 border border-app-border rounded text-xs focus:ring-1 focus:ring-app-primary focus:outline-hidden bg-app-surface text-app-text font-mono font-bold"
                  id="add-roll-no"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-app-text/45 mb-1.5 uppercase tracking-wider">Número de Rollo</label>
                <input
                  type="text"
                  disabled
                  value="[ Auto-Generado por Sistema ]"
                  className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-bg text-app-text/45 font-mono"
                />
              </div>
            )}

            {/* Dynamic field: Lot */}
            {activeProviderConfig?.hasLot ? (
              <div>
                <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Lote del Proveedor *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. LT-2500"
                  value={lot}
                  onChange={e => setLot(e.target.value)}
                  className="w-full px-3 py-1.5 border border-app-border rounded text-xs focus:ring-1 focus:ring-app-primary focus:outline-hidden bg-app-surface text-app-text font-mono"
                  id="add-roll-lot"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-app-text/45 mb-1.5 uppercase tracking-wider">Lote del Proveedor</label>
                <input
                  type="text"
                  disabled
                  value="N/A (Desactivado)"
                  className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-bg text-app-text/45 font-mono"
                />
              </div>
            )}

            {/* Dynamic field: Partida */}
            {activeProviderConfig?.hasPartida ? (
              <div>
                <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Partida / Batch *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. PT-012"
                  value={partida}
                  onChange={e => setPartida(e.target.value)}
                  className="w-full px-3 py-1.5 border border-app-border rounded text-xs focus:ring-1 focus:ring-app-primary focus:outline-hidden bg-app-surface text-app-text font-mono"
                  id="add-roll-partida"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-app-text/45 mb-1.5 uppercase tracking-wider">Partida / Batch</label>
                <input
                  type="text"
                  disabled
                  value="N/A (Desactivado)"
                  className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-bg text-app-text/45 font-mono"
                />
              </div>
            )}

            {/* Dynamic field: Tono */}
            {activeProviderConfig?.hasTono ? (
              <div>
                <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Tono / Color Exacto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. VERDE-PETROLEO-3"
                  value={tono}
                  onChange={e => setTono(e.target.value)}
                  className="w-full px-3 py-1.5 border border-app-border rounded text-xs focus:ring-1 focus:ring-app-primary focus:outline-hidden bg-app-surface text-app-text font-mono"
                  id="add-roll-tono"
                />
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-app-text/45 mb-1.5 uppercase tracking-wider">Tono / Color Exacto</label>
                <input
                  type="text"
                  disabled
                  value="N/A (Desactivado)"
                  className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-bg text-app-text/45 font-mono"
                />
              </div>
            )}

            {/* Submit button */}
            <div className="flex items-end justify-end md:col-span-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-1.5 bg-app-primary hover:bg-app-primary/90 text-white font-bold rounded text-xs transition cursor-pointer shadow-xs disabled:opacity-50 uppercase tracking-wider"
                id="btn-submit-add-roll"
              >
                {loading ? 'Procesando...' : 'Guardar Ingreso'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Advanced filters controls */}
      <div className="bg-app-surface border border-app-border rounded-lg p-5 shadow-xs">
        <h4 className="text-xs font-bold text-app-text/50 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <Filter size={12} className="text-app-text/50" />
          Filtros de Búsqueda Avanzados
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Búsqueda rápida (Criterios)</label>
            <div className="relative">
              <Search className="absolute left-3 top-2 text-app-text/45" size={13} />
              <input
                type="text"
                placeholder="Nº Rollo, Artículo, Lote, Tono, Partida..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-app-border rounded text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary bg-app-surface text-app-text transition font-medium"
                id="search-inventory"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Proveedor</label>
            <select
              value={filterProviderId}
              onChange={e => setFilterProviderId(e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:outline-hidden focus:ring-1 focus:ring-app-primary font-medium transition cursor-pointer"
              id="filter-inv-prov"
            >
              <option value="all">Todos</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Artículo (Tela)</label>
            <select
              value={filterArticleId}
              onChange={e => setFilterArticleId(e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:outline-hidden focus:ring-1 focus:ring-app-primary font-medium transition cursor-pointer"
              id="filter-inv-art"
            >
              <option value="all">Todos</option>
              {articles.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Estado de Stock</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:outline-hidden focus:ring-1 focus:ring-app-primary font-medium transition cursor-pointer"
              id="filter-inv-status"
            >
              <option value="all">Todos (Histórico)</option>
              <option value="available">Con Stock Disponible</option>
              <option value="sold">Agotados (Stock 0m)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Fecha Registro (Desde)</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary font-medium focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Fecha Registro (Hasta)</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary font-medium focus:outline-hidden"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3 mt-5 pt-4 border-t border-app-border">
          <p className="text-xs text-app-text/60 font-medium">
            Encontrados: <span className="font-semibold text-app-text">{filteredInventory.length}</span> rollos textiles en almacén.
          </p>
          <button
            onClick={handleExportExcel}
            className="px-4 py-1.5 bg-app-surface hover:bg-app-bg text-app-text border border-app-border rounded text-[10px] font-bold flex items-center gap-1.5 transition uppercase tracking-wider cursor-pointer"
            id="btn-export-excel"
          >
            <FileSpreadsheet size={12} className="text-app-text/50" />
            Exportar Inventario
          </button>
        </div>
      </div>

      {/* Inventory table */}
      <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-app-bg/45 border-b border-app-border text-[10px] text-app-text/60 uppercase font-bold tracking-wider">
                <th className="p-4 pl-5">Número de Rollo</th>
                <th className="p-4">Artículo / Tela</th>
                <th className="p-4">Proveedor</th>
                <th className="p-4 font-mono">Lote</th>
                <th className="p-4 font-mono">Partida</th>
                <th className="p-4 font-mono">Tono</th>
                <th className="p-4 text-right">Mts. Iniciales</th>
                <th className="p-4 text-right">Mts. Disponibles</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-right pr-5">Ajuste / Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40 text-xs text-app-text">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-app-text/50 font-medium">
                    No se encontraron rollos de tela con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                filteredInventory.map(item => {
                  const article = articles.find(a => a.id === item.articleId);
                  const provider = providers.find(p => p.id === item.providerId);
                  const isAvailable = item.currentMeters > 0;

                  return (
                    <tr key={item.id} className={`hover:bg-app-bg/40 transition duration-150 ${!isAvailable ? 'bg-app-bg/20 text-app-text/45' : ''}`}>
                      <td className="p-4 pl-5 font-mono font-bold text-app-text">
                        <span className="warehouse-tag">{item.rollNumber}</span>
                      </td>
                      <td className="p-4 font-semibold text-app-text">
                        {article?.name || 'Artículo Eliminado'}
                      </td>
                      <td className="p-4 text-app-text/60 font-medium">
                        {provider?.name || 'Proveedor Eliminado'}
                      </td>
                      <td className="p-4 font-mono">{item.lot || '-'}</td>
                      <td className="p-4 font-mono">{item.partida || '-'}</td>
                      <td className="p-4 font-mono">{item.tono || '-'}</td>
                      <td className="p-4 text-right font-mono font-medium text-app-text/45">{item.initialMeters.toFixed(2)} m</td>
                      <td className={`p-4 text-right font-mono font-bold ${isAvailable ? 'text-app-secondary text-sm' : 'text-app-text/45'}`}>
                        {item.currentMeters.toFixed(2)} m
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2 py-0.5 text-[9px] rounded font-bold border ${
                          isAvailable
                            ? 'bg-app-bg text-app-secondary border-app-secondary/35'
                            : 'bg-app-bg/50 text-app-text/40 border-app-border/40'
                        }`}>
                          {isAvailable ? 'DISPONIBLE' : 'AGOTADO'}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-5">
                        <div className="flex justify-end gap-1 items-center">
                          {adjustingId === item.id ? (
                            <form onSubmit={handleAdjustSubmit} className="flex items-center gap-1.5 max-w-xs no-print">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={adjustedMeters}
                                onChange={e => setAdjustedMeters(Number(e.target.value))}
                                className="w-16 px-1.5 py-1 border border-app-border rounded text-xs text-right font-mono font-bold bg-app-surface text-app-text"
                              />
                              <input
                                type="text"
                                placeholder="Nota..."
                                value={adjustNotes}
                                onChange={e => setAdjustNotes(e.target.value)}
                                className="w-16 px-1.5 py-1 border border-app-border rounded text-[10px] bg-app-surface text-app-text"
                              />
                              <button
                                type="submit"
                                className="px-2 py-1 bg-app-primary hover:bg-app-primary/90 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                SÍ
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdjustingId(null)}
                                className="px-2 py-1 bg-app-bg text-app-text hover:bg-app-border rounded text-[10px] font-bold cursor-pointer"
                              >
                                NO
                              </button>
                            </form>
                          ) : (
                            <div className="flex gap-1 no-print">
                              <button
                                onClick={() => {
                                  setAdjustingId(item.id);
                                  setAdjustedMeters(item.currentMeters);
                                }}
                                className="p-1 bg-app-surface hover:bg-app-bg text-app-text/50 hover:text-app-text border border-app-border rounded transition cursor-pointer"
                                title="Ajustar metros"
                              >
                                <Wrench size={12} />
                              </button>
                              <button
                                onClick={() => initiateDeleteRoll(item)}
                                className="p-1 bg-app-surface hover:bg-app-bg text-app-text/50 hover:text-red-600 border border-app-border rounded transition cursor-pointer"
                                title="Eliminar Rollo"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Roll Deletion Confirmation Modal */}
      {deleteTargetRoll && (
        <div className="fixed inset-0 bg-app-bg/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-app-surface border border-app-border rounded w-full max-w-md shadow-xl overflow-hidden animate-slide-up text-app-text">
            
            {/* Header */}
            <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-950/40 p-5 flex items-center gap-3">
              <div className="bg-red-500 text-white p-2 rounded">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">ELIMINAR ROLLO FÍSICO</h4>
                <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mt-0.5">AVISO DE INVENTARIO</p>
              </div>
              <button 
                onClick={() => !isDeletingRoll && setDeleteTargetRoll(null)} 
                className="ml-auto text-app-text/45 hover:text-app-text cursor-pointer"
                disabled={isDeletingRoll}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {deleteRollSuccess ? (
                <div className="text-center py-3">
                  <div className="inline-flex items-center justify-center bg-app-bg text-app-secondary p-3 rounded mb-3">
                    <CheckCircle size={24} />
                  </div>
                  <p className="text-xs font-bold text-app-text">{deleteRollSuccess}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-medium leading-relaxed text-app-text/80">
                    ¿Está totalmente seguro de que desea eliminar permanentemente el rollo de almacén <strong className="text-app-text bg-app-bg px-1.5 py-0.5 rounded font-mono font-bold">{deleteTargetRoll.rollNumber}</strong>?
                  </p>
                  
                  <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-200/80 dark:border-red-900/30 rounded p-3 text-[10px] text-red-900 dark:text-red-300 font-medium leading-normal">
                    ⚠️ <strong>ATENCIÓN ALMACÉN:</strong> Esta acción borrará permanentemente la existencia de este rollo del inventario activo y se registrará un movimiento contable de ajuste negativo en las bitácoras.
                  </div>

                  {deleteRollError && (
                    <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/40 p-3 text-[11px] text-red-800 dark:text-red-400 font-semibold font-mono leading-tight">
                      ERROR: {deleteRollError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            {!deleteRollSuccess && (
              <div className="bg-app-bg px-6 py-4 border-t border-app-border flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setDeleteTargetRoll(null)}
                  disabled={isDeletingRoll}
                  className="px-3 py-1.5 hover:bg-app-border text-app-text/75 hover:text-app-text border border-app-border rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDeleteRoll}
                  disabled={isDeletingRoll}
                  className="px-3 py-1.5 bg-red-650 hover:bg-red-750 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingRoll ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Trash2 size={12} />
                      Confirmar Borrado
                    </>
                  )}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
