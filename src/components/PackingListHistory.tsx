import React, { useState, useMemo, useEffect } from 'react';
import { PackingList, Client, Seller, Provider, Article } from '../types';
import { db, deleteDoc } from '../firebase';
import { doc } from 'firebase/firestore';
import { Search, Filter, Printer, Trash2, Calendar, User, Eye, Layers, FileText, AlertTriangle, CheckCircle, RefreshCw, X, Edit2, Copy, FileSpreadsheet, MessageCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PackingListHistoryProps {
  packingLists: PackingList[];
  clients: Client[];
  sellers: Seller[];
  providers: Provider[];
  articles: Article[];
  onRefresh: () => Promise<void>;
  onSelectPrint: (pl: PackingList) => void;
  onEdit: (pl: PackingList) => void;
  onDuplicate: (pl: PackingList) => void;
  initialSearchTerm?: string;
}

export default function PackingListHistory({
  packingLists,
  clients,
  sellers,
  providers,
  articles,
  onRefresh,
  onSelectPrint,
  onEdit,
  onDuplicate,
  initialSearchTerm
}: PackingListHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Handle external filtering from global search
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClientId, setFilterClientId] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showOnlyNoGuide, setShowOnlyNoGuide] = useState(false);

  // Custom modal states for secure deletion
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; plNo: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || 'Cliente Eliminado';
  const getSellerName = (id: string) => sellers.find(s => s.id === id)?.name || 'Vendedor Eliminado';
  const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || id;
  const getProviderName = (id: string) => providers.find(p => p.id === id)?.name || id;

  const handleShareWhatsApp = (pl: PackingList) => {
    const guideLine = pl.guideNumber && pl.guideNumber.trim() !== ''
      ? `Packing List Guía N°: ${pl.guideNumber.trim()}`
      : 'Packing List';

    const clientName = getClientName(pl.clientId);
    const totalMeters = pl.items.reduce((acc, item) => acc + item.meters, 0);

    const text = `${guideLine}
Cliente: ${clientName}
Fecha: ${pl.date}
Total Rollos: ${pl.totalRollsOrCuts}
Total Metros: ${totalMeters.toFixed(2)} m`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // 1. Export summary of filtered Packing Lists to Excel
  const handleExportSummary = () => {
    const data = filteredLists.map(pl => {
      const totalMeters = pl.items.reduce((acc, item) => acc + item.meters, 0);
      return {
        'Nº Packing List': pl.packingListNo,
        'Fecha Despacho': pl.date,
        'Cliente': getClientName(pl.clientId),
        'Vendedor': getSellerName(pl.sellerId),
        'Cant. Ítems / Rollos': pl.items.length,
        'Mts Despachados (m)': Number(totalMeters.toFixed(2)),
        'Notas / Observaciones': pl.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 18 }, // PL
      { wch: 15 }, // Fecha
      { wch: 30 }, // Cliente
      { wch: 20 }, // Vendedor
      { wch: 20 }, // Cant Ítems
      { wch: 20 }, // Mts
      { wch: 40 }  // Notas
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen Despachos');
    XLSX.writeFile(wb, `Resumen_Despachos_PackingLists_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 2. Export deep/flattened details of all filtered roll items to Excel
  const handleExportFullDetails = () => {
    let hasLote = false;
    let hasPartida = false;
    let hasTono = false;
    let hasWidth = false;
    let hasWeight = false;

    filteredLists.forEach(pl => {
      pl.items.forEach(item => {
        if (item.lot && item.lot.trim() !== '') hasLote = true;
        if (item.partida && item.partida.trim() !== '') hasPartida = true;
        if (item.tono && item.tono.trim() !== '') hasTono = true;
        if (item.width && item.width.trim() !== '') hasWidth = true;
        if (item.weight && item.weight.trim() !== '') hasWeight = true;
      });
    });

    const data: any[] = [];
    
    filteredLists.forEach(pl => {
      pl.items.forEach(item => {
        const articleObj = articles.find(a => a.id === item.articleId);
        
        const row: any = {
          'Nº Packing List': pl.packingListNo,
          'Fecha Despacho': pl.date,
          'Cliente': getClientName(pl.clientId),
          'Vendedor': getSellerName(pl.sellerId),
          'Artículo / Tela': articleObj?.name || item.articleId || '',
          'Descripción Artículo': articleObj?.description || '',
          'Rollo / Ítem Nº': item.rollNumber,
          'Metraje Despachado (m)': Number(item.meters.toFixed(2)),
        };

        if (hasLote) {
          row['Lote'] = item.lot || '';
        }
        if (hasPartida) {
          row['Partida'] = item.partida || '';
        }
        if (hasTono) {
          row['Tono'] = item.tono || '';
        }
        if (hasWidth) {
          row['Ancho'] = item.width || '';
        }
        if (hasWeight) {
          row['Peso'] = item.weight || '';
        }

        row['Notas / Observaciones'] = pl.notes || '';
        data.push(row);
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Set column widths dynamically
    const cols = [
      { wch: 18 }, // PL
      { wch: 15 }, // Fecha
      { wch: 30 }, // Cliente
      { wch: 20 }, // Vendedor
      { wch: 25 }, // Tela
      { wch: 30 }, // Desc
      { wch: 15 }, // Rollo
      { wch: 22 }, // Metraje
    ];
    if (hasLote) cols.push({ wch: 15 });
    if (hasPartida) cols.push({ wch: 15 });
    if (hasTono) cols.push({ wch: 10 });
    if (hasWidth) cols.push({ wch: 12 });
    if (hasWeight) cols.push({ wch: 12 });
    cols.push({ wch: 40 }); // Notas

    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle de Rollos');
    XLSX.writeFile(wb, `Detalle_General_Despachos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 3. Export a single Packing List in beautiful, print-ready custom format
  const handleExportSinglePL = (pl: PackingList) => {
    const clientName = getClientName(pl.clientId);
    const clientObj = clients.find(c => c.id === pl.clientId);
    const sellerName = getSellerName(pl.sellerId);

    let hasLote = false;
    let hasPartida = false;
    let hasTono = false;
    let hasWidth = false;
    let hasWeight = false;

    pl.items.forEach(item => {
      if (item.lot && item.lot.trim() !== '') hasLote = true;
      if (item.partida && item.partida.trim() !== '') hasPartida = true;
      if (item.tono && item.tono.trim() !== '') hasTono = true;
      if (item.width && item.width.trim() !== '') hasWidth = true;
      if (item.weight && item.weight.trim() !== '') hasWeight = true;
    });
    
    const headerInfo = [
      ['DETALLE DE DOCUMENTO - PACKING LIST', ''],
      ['', ''],
      ['Número de Packing List:', pl.packingListNo],
      ['Fecha de Despacho:', pl.date],
      ['Cliente:', clientName],
      ['RUC/DNI Cliente:', clientObj?.dni || ''],
      ['Vendedor:', sellerName],
      ['Notas / Observaciones:', pl.notes || ''],
      ['', ''],
      ['DETALLE DE ARTÍCULOS Y ROLLOS DESPACHADOS', ''],
      ['', '']
    ];

    const tableHeaders = [
      'Ítem',
      'Artículo / Tela',
      'Descripción',
    ];
    if (hasLote) tableHeaders.push('Lote');
    if (hasPartida) tableHeaders.push('Partida');
    if (hasTono) tableHeaders.push('Tono');
    if (hasWidth) tableHeaders.push('Ancho');
    if (hasWeight) tableHeaders.push('Peso');
    tableHeaders.push('Rollo / Corte Nro', 'Metraje Despachado (m)');

    const itemRows = pl.items.map((item, index) => {
      const articleObj = articles.find(a => a.id === item.articleId);
      const row: any[] = [
        index + 1,
        articleObj?.name || item.articleId || '',
        articleObj?.description || '',
      ];
      if (hasLote) row.push(item.lot || '');
      if (hasPartida) row.push(item.partida || '');
      if (hasTono) row.push(item.tono || '');
      if (hasWidth) row.push(item.width || '');
      if (hasWeight) row.push(item.weight || '');
      row.push(item.rollNumber, Number(item.meters.toFixed(2)));
      return row;
    });

    const numCols = tableHeaders.length;
    const totalMeters = pl.items.reduce((acc, item) => acc + item.meters, 0);
    
    const footerRows = [
      Array(numCols).fill(''),
      ['RESUMEN TOTALES', ...Array(numCols - 3).fill(''), 'Total Ítems/Rollos', pl.items.length],
      [...Array(numCols - 2).fill(''), 'Total Metraje Despachado', Number(totalMeters.toFixed(2))]
    ];

    const fullMatrix = [
      ...headerInfo,
      tableHeaders,
      ...itemRows,
      ...footerRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(fullMatrix);
    
    // Auto fit/set column widths dynamically
    const cols = [
      { wch: 8 },  // Ítem / Label
      { wch: 25 }, // Tela
      { wch: 30 }, // Desc
    ];
    if (hasLote) cols.push({ wch: 15 });
    if (hasPartida) cols.push({ wch: 15 });
    if (hasTono) cols.push({ wch: 10 });
    if (hasWidth) cols.push({ wch: 12 });
    if (hasWeight) cols.push({ wch: 12 });
    cols.push(
      { wch: 20 }, // Rollo / Label
      { wch: 25 }  // Metraje / Value
    );

    ws['!cols'] = cols;

    // Merge titles for styling
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }, // Title 1
      { s: { r: 9, c: 0 }, e: { r: 9, c: numCols - 1 } } // Title 2
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `PL ${pl.packingListNo}`);
    XLSX.writeFile(wb, `PackingList_${pl.packingListNo}.xlsx`);
  };

  // Sort packing lists by sequential PL number descending (newest number first)
  const sortedPackingLists = useMemo(() => {
    return [...packingLists].sort((a, b) => {
      const getNum = (no: string) => {
        const match = no?.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      const numA = getNum(a.packingListNo);
      const numB = getNum(b.packingListNo);
      if (numA !== numB) {
        return numB - numA; // Sort by PL number descending
      }
      // If PL numbers are same or don't have numbers, fallback to date descending
      return new Date(b.date + 'T00:00:00').getTime() - new Date(a.date + 'T00:00:00').getTime();
    });
  }, [packingLists]);

  // Filter packing lists
  const filteredLists = useMemo(() => {
    return sortedPackingLists.filter(pl => {
      // 1. General search term (Matches PL No, Client name, Seller name)
      const clientName = getClientName(pl.clientId);
      const sellerName = getSellerName(pl.sellerId);
      const searchText = `${pl.packingListNo} ${clientName} ${sellerName}`.toLowerCase();
      const matchesSearch = searchText.includes(searchTerm.toLowerCase());

      // 2. Type Filter (Roll or Cut)
      const matchesType = filterType === 'all' || pl.type === filterType;

      // 3. Client Filter
      const matchesClient = filterClientId === 'all' || pl.clientId === filterClientId;

      // 4. Date Range
      let matchesDate = true;
      if (startDate && pl.date < startDate) matchesDate = false;
      if (endDate && pl.date > endDate) matchesDate = false;

      // 5. No Guide Filter
      let matchesNoGuide = true;
      if (showOnlyNoGuide) {
        matchesNoGuide = !pl.guideNumber || pl.guideNumber.trim() === '';
      }

      return matchesSearch && matchesType && matchesClient && matchesDate && matchesNoGuide;
    });
  }, [sortedPackingLists, searchTerm, filterType, filterClientId, startDate, endDate, showOnlyNoGuide, clients, sellers]);

  const initiateDelete = (id: string, plNo: string) => {
    setDeleteError(null);
    setDeleteSuccess(null);
    setDeleteTarget({ id, plNo });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Explicitly trigger the deletion from Firestore/LocalStorage wrappers
      await deleteDoc(doc(db, 'packinglists', deleteTarget.id));
      
      // Let the main layout trigger database sync
      await onRefresh();
      
      setDeleteSuccess(`El packing list "${deleteTarget.plNo}" se eliminó de manera permanente y exitosa.`);
      setTimeout(() => {
        setDeleteTarget(null);
        setDeleteSuccess(null);
      }, 2500);
    } catch (err) {
      console.error("Delete operation failed:", err);
      setDeleteError(err instanceof Error ? err.message : 'Error desconocido al procesar la eliminación de base de datos.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters - Serious High End UI */}
      <div className="bg-app-surface border border-app-border rounded-lg p-5 shadow-xs">
        <h3 className="text-xs font-bold text-app-text/50 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Filter size={12} className="text-app-text/50" />
          Filtros de Búsqueda de Despachos
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
          {/* Quick search */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Buscar por Documento o Cliente</label>
            <div className="relative">
              <Search className="absolute left-3 top-2 text-app-text/45" size={13} />
              <input
                type="text"
                placeholder="Nº Packing list, cliente, vendedor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-app-border rounded text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary bg-app-surface text-app-text transition"
                id="search-packinglist"
              />
            </div>
          </div>

          {/* Type filter */}
          <div>
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Tipo de Formato</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary focus:outline-hidden transition cursor-pointer font-medium"
              id="filter-pl-type"
            >
              <option value="all">Todos los formatos</option>
              <option value="nuevo">P. List Nuevo (Rollos)</option>
              <option value="antiguo">P. List Antiguo (Cortes)</option>
              <option value="corte">P. List Corte (Cortes)</option>
              <option value="rollo">Legacy (Rollos)</option>
            </select>
          </div>

          {/* Date range filter */}
          <div>
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Desde Fecha</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary transition font-medium focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-app-text/60 mb-1.5 uppercase tracking-wider">Hasta Fecha</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded text-xs bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary transition font-medium focus:outline-hidden"
            />
          </div>
        </div>

        {/* Filtro adicional para guía */}
        <div className="mt-4 flex items-center">
          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-app-text/80 select-none">
            <input
              type="checkbox"
              checked={showOnlyNoGuide}
              onChange={e => setShowOnlyNoGuide(e.target.checked)}
              className="rounded border-app-border text-app-primary focus:ring-app-primary focus:ring-offset-0 bg-app-surface w-4 h-4 cursor-pointer"
              id="filter-pl-no-guide"
            />
            <span>Mostrar solo Packing Lists sin número de guía</span>
          </label>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3 mt-5 pt-4 border-t border-app-border">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-app-text/60 font-medium">
              Mostrando <span className="font-semibold text-app-text">{filteredLists.length}</span> documentos de packing list registrados.
            </p>
            {filteredLists.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportSummary}
                  className="px-3 py-1 bg-app-surface hover:bg-app-bg text-app-text border border-app-border rounded text-[10px] font-bold flex items-center gap-1.5 transition uppercase tracking-wider cursor-pointer"
                  title="Exportar resumen de documentos filtrados a Excel"
                >
                  <FileSpreadsheet size={12} className="text-app-text/50" />
                  Exportar Resumen
                </button>
                <button
                  onClick={handleExportFullDetails}
                  className="px-3 py-1 bg-app-primary hover:bg-app-primary/90 text-white rounded text-[10px] font-bold flex items-center gap-1.5 transition uppercase tracking-wider cursor-pointer shadow-xs"
                  title="Exportar todos los rollos/cortes de documentos filtrados en formato plano a Excel"
                >
                  <FileSpreadsheet size={12} />
                  Exportar Detalle Completo
                </button>
              </div>
            )}
          </div>
          {(searchTerm || filterType !== 'all' || startDate || endDate || showOnlyNoGuide) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('all');
                setStartDate('');
                setEndDate('');
                setShowOnlyNoGuide(false);
              }}
              className="text-[10px] uppercase tracking-wider text-app-text/60 hover:text-app-text font-bold transition cursor-pointer"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards / Statistics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Despachos */}
        <div className="ticket-perforated p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-app-text/50 uppercase tracking-wider">Total de Despachos</span>
            <span className="bg-app-bg text-app-text text-[10px] px-2 py-0.5 rounded font-bold">Docs</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-app-text tracking-tight">{filteredLists.length}</span>
            <span className="text-[10px] text-app-text/50 block mt-1 font-medium">Documentos registrados en este filtro</span>
          </div>
        </div>

        {/* Card 2: Total Metraje */}
        <div className="ticket-perforated p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-app-text/50 uppercase tracking-wider">Metraje Despachado</span>
            <span className="bg-app-bg text-app-secondary text-[10px] px-2 py-0.5 rounded font-bold">Mts</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-app-text tracking-tight">
              {filteredLists.reduce((acc, pl) => acc + pl.items.reduce((sum, item) => sum + item.meters, 0), 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-app-text/50 block mt-1 font-medium">Metros totales despachados</span>
          </div>
        </div>

        {/* Card 3: Total Rollos / Cortes */}
        <div className="ticket-perforated p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-app-text/50 uppercase tracking-wider">Total Rollos / Cortes</span>
            <span className="bg-app-bg text-app-text text-[10px] px-2 py-0.5 rounded font-bold">Ítems</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-app-text tracking-tight">
              {filteredLists.reduce((acc, pl) => acc + pl.items.length, 0)}
            </span>
            <span className="text-[10px] text-app-text/50 block mt-1 font-medium">Cantidad de piezas despachadas</span>
          </div>
        </div>
      </div>

      {/* History Table - Corporate Grid Layout */}
      <div className="bg-app-surface border border-app-border rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-app-bg/45 border-b border-app-border text-[10px] text-app-text/60 uppercase font-bold tracking-wider">
                <th className="p-4 pl-5 text-center w-12">Nº</th>
                <th className="p-4">Nº Packing List</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Fecha Despacho</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Vendedor</th>
                <th className="p-4 text-center">Cant. Ítems</th>
                <th className="p-4 text-right">Mts Despachados</th>
                <th className="p-4 text-right pr-5">Operaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/40 text-xs text-app-text">
              {filteredLists.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-app-text/50 font-medium">
                    <FileText size={24} className="mx-auto text-app-text/45 mb-2" />
                    No se encontraron documentos de packing list con los filtros de búsqueda aplicados.
                  </td>
                </tr>
              ) : (
                filteredLists.map((pl, index) => {
                  const totalMeters = pl.items.reduce((acc, item) => acc + item.meters, 0);

                  return (
                    <tr key={pl.id} className="hover:bg-app-bg/40 transition duration-150">
                      <td className="p-4 pl-5 text-center font-mono font-bold text-app-text/50 bg-app-bg/10">{index + 1}</td>
                      <td className="p-4 font-mono font-bold text-app-text">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="warehouse-tag">{pl.packingListNo}</span>
                          {(!pl.guideNumber || pl.guideNumber.trim() === '') ? (
                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider bg-[#B5822A]/10 text-[#B5822A] border border-[#B5822A]/25">
                              SIN GUÍA
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-app-text/50 font-sans tracking-normal" title={`Nº Guía: ${pl.guideNumber}`}>
                              Guía: {pl.guideNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2 py-0.5 text-[9px] rounded font-bold uppercase tracking-wider ${
                          pl.type === 'nuevo' || pl.type === 'rollo'
                            ? 'bg-app-bg text-app-text border border-app-border'
                            : pl.type === 'antiguo'
                            ? 'bg-app-bg/50 text-app-text/70 border border-app-border/60'
                            : 'bg-app-bg text-app-secondary border border-app-secondary/35'
                        }`}>
                          {pl.type === 'nuevo' ? 'Nuevo' : pl.type === 'antiguo' ? 'Antiguo' : pl.type === 'corte' ? 'Corte' : 'Legacy'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[11px]">
                        <div className="font-semibold text-app-text">{pl.date}</div>
                        {pl.createdAt && (
                          <div className="text-[10px] text-app-text/50 font-semibold mt-0.5 flex items-center gap-1">
                            <span className="text-app-text/45 font-normal">Hora:</span>
                            {(() => {
                              try {
                                const d = new Date(pl.createdAt);
                                if (!isNaN(d.getTime())) {
                                  let hours = d.getHours();
                                  const minutes = String(d.getMinutes()).padStart(2, '0');
                                  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
                                  hours = hours % 12;
                                  hours = hours ? hours : 12;
                                  return `${hours}:${minutes} ${ampm}`;
                                }
                              } catch (e) {}
                              return '--:--';
                            })()}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-app-text">{getClientName(pl.clientId)}</td>
                      <td className="p-4 text-app-text/60 font-medium">{getSellerName(pl.sellerId)}</td>
                      <td className="p-4 text-center font-mono font-bold text-app-text bg-app-bg/10">{pl.items.length}</td>
                      <td className="p-4 text-right font-mono font-bold text-app-text">{totalMeters.toFixed(2)} m</td>
                      <td className="p-4 text-right pr-5">
                        <div className="flex justify-end items-center gap-1">
                          <button
                            onClick={() => onSelectPrint(pl)}
                            className="px-2.5 py-1 bg-app-primary hover:bg-app-primary/90 text-white font-bold rounded text-[10px] flex items-center gap-1 transition uppercase tracking-wider shadow-xs cursor-pointer"
                            id={`btn-view-pl-${pl.packingListNo}`}
                          >
                            <Eye size={12} />
                            Imprimir / PDF
                          </button>
                          <button
                            onClick={() => handleShareWhatsApp(pl)}
                            className="p-1 bg-app-surface hover:bg-[#25D366]/10 text-app-text/60 hover:text-[#25D366] border border-app-border rounded transition cursor-pointer flex items-center justify-center"
                            title="Compartir por WhatsApp"
                          >
                            <MessageCircle size={12} />
                          </button>
                          <button
                            onClick={() => onEdit(pl)}
                            className="p-1 bg-app-surface hover:bg-app-bg text-app-text/60 hover:text-app-primary border border-app-border rounded transition cursor-pointer"
                            title="Modificar / Editar Packing List"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => onDuplicate(pl)}
                            className="p-1 bg-app-surface hover:bg-app-bg text-app-text/60 hover:text-app-text border border-app-border rounded transition cursor-pointer"
                            title="Duplicar / Clonar Packing List"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            onClick={() => handleExportSinglePL(pl)}
                            className="p-1 bg-app-surface hover:bg-app-bg text-app-text/60 hover:text-app-secondary border border-app-border rounded transition cursor-pointer"
                            title="Exportar este Packing List a Excel"
                          >
                            <FileSpreadsheet size={12} />
                          </button>
                          <button
                            onClick={() => initiateDelete(pl.id, pl.packingListNo)}
                            className="p-1 bg-app-surface hover:bg-app-bg text-app-text/45 hover:text-red-600 border border-app-border rounded transition cursor-pointer"
                            title="Eliminar registro permanente"
                          >
                            <Trash2 size={12} />
                          </button>
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

      {/* Custom Enterprise Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-app-bg/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-app-surface border border-app-border rounded w-full max-w-md shadow-xl overflow-hidden animate-slide-up text-app-text">
            
            {/* Header */}
            <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-950/40 p-5 flex items-center gap-3">
              <div className="bg-red-500 text-white p-2 rounded">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">ADVERTENCIA CRÍTICA</h4>
                <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mt-0.5">ELIMINACIÓN PERMANENTE</p>
              </div>
              <button 
                onClick={() => !isDeleting && setDeleteTarget(null)} 
                className="ml-auto text-app-text/45 hover:text-app-text cursor-pointer"
                disabled={isDeleting}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {deleteSuccess ? (
                <div className="text-center py-3">
                  <div className="inline-flex items-center justify-center bg-app-bg text-app-secondary p-3 rounded mb-3">
                    <CheckCircle size={24} />
                  </div>
                  <p className="text-xs font-bold text-app-text">{deleteSuccess}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs font-medium leading-relaxed text-app-text/80">
                    ¿Está totalmente seguro de que desea eliminar permanentemente el packing list <strong className="text-app-text bg-app-bg px-1.5 py-0.5 rounded font-mono font-bold">{deleteTarget.plNo}</strong>?
                  </p>
                  
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded p-3 text-[10px] text-amber-900 dark:text-amber-300 font-medium leading-normal">
                    ⚠️ <strong>AVISO DE EXCLUSIÓN:</strong> Esta acción borrará permanentemente el despacho de la base de datos y no se podrá recuperar. Asegúrese de que no afecte los reportes contables ni el inventario de rollos vinculados.
                  </div>

                  {deleteError && (
                    <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/40 p-3 text-[11px] text-red-800 dark:text-red-400 font-semibold font-mono whitespace-pre-wrap leading-tight">
                      ERROR: {deleteError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            {!deleteSuccess && (
              <div className="bg-app-bg px-6 py-4 border-t border-app-border flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 hover:bg-app-border text-app-text/75 hover:text-app-text border border-app-border rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 size={12} />
                      Eliminar de Todo Lado
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
