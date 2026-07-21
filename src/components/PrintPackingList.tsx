import React, { useMemo } from 'react';
import { PackingList, PackingListItem, Client, Seller, Provider, Article } from '../types';
import { FileText, Printer, X, AlertTriangle, MessageCircle } from 'lucide-react';

const ROWS_PER_PAGE = 32;

export interface PrintableRow {
  type: 'header' | 'roll' | 'footer';
  articleId: string;
  articleName?: string;
  item?: PackingListItem;
  index?: number;
  articleTotalMeters?: number;
  groupLength?: number;
}

export function getPaginatedBlocks(groupedItems: Record<string, PackingListItem[]>, getArticleName: (id: string) => string): PrintableRow[][] {
  const flatItems: PrintableRow[] = [];
  Object.keys(groupedItems).forEach(articleId => {
    const groupItems = groupedItems[articleId];
    const articleName = getArticleName(articleId);
    const articleTotalMeters = groupItems.reduce((acc, item) => acc + Number(item.meters || 0), 0);
    
    flatItems.push({
      type: 'header',
      articleId,
      articleName
    });
    
    groupItems.forEach((item, idx) => {
      flatItems.push({
        type: 'roll',
        articleId,
        item,
        index: idx
      });
    });
    
    flatItems.push({
      type: 'footer',
      articleId,
      articleName,
      articleTotalMeters,
      groupLength: groupItems.length
    });
  });

  const blocks: PrintableRow[][] = [];
  let currentBlock: PrintableRow[] = [];
  let currentRollsInBlock = 0;

  for (let i = 0; i < flatItems.length; i++) {
    const row = flatItems[i];
    
    if (row.type === 'roll') {
      if (currentRollsInBlock >= ROWS_PER_PAGE) {
        blocks.push(currentBlock);
        currentBlock = [];
        currentRollsInBlock = 0;
      }
      currentBlock.push(row);
      currentRollsInBlock++;
    } else if (row.type === 'header') {
      if (currentRollsInBlock >= ROWS_PER_PAGE) {
        blocks.push(currentBlock);
        currentBlock = [];
        currentRollsInBlock = 0;
      }
      currentBlock.push(row);
    } else if (row.type === 'footer') {
      currentBlock.push(row);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  // If there's only 1 block but it has exactly ROWS_PER_PAGE rolls,
  // the Totales and Aviso Importante will overflow to a new page with 0 rolls.
  // To avoid this, we can force-create a second block and move the last roll there.
  if (blocks.length === 1) {
    const rollCount = blocks[0].filter(r => r.type === 'roll').length;
    if (rollCount >= ROWS_PER_PAGE) {
      blocks.push([]);
    }
  }

  // Ensure the last block has at least one roll row
  if (blocks.length > 1) {
    const lastBlock = blocks[blocks.length - 1];
    const hasRoll = lastBlock.some(r => r.type === 'roll');
    if (!hasRoll) {
      const prevBlock = blocks[blocks.length - 2];
      // Find the last roll in prevBlock
      let lastRollIdx = -1;
      for (let j = prevBlock.length - 1; j >= 0; j--) {
        if (prevBlock[j].type === 'roll') {
          lastRollIdx = j;
          break;
        }
      }
      if (lastRollIdx !== -1) {
        const rollToMove = prevBlock[lastRollIdx];
        prevBlock.splice(lastRollIdx, 1);
        lastBlock.unshift(rollToMove);
        
        // Move its header too if there are no more rolls of that article in prevBlock
        const articleIdOfMovedRoll = rollToMove.articleId;
        const remainingRollsOfArticle = prevBlock.filter(r => r.type === 'roll' && r.articleId === articleIdOfMovedRoll).length;
        if (remainingRollsOfArticle === 0) {
          const headerIdx = prevBlock.findIndex(r => r.type === 'header' && r.articleId === articleIdOfMovedRoll);
          if (headerIdx !== -1) {
            const headerToMove = prevBlock[headerIdx];
            prevBlock.splice(headerIdx, 1);
            lastBlock.unshift(headerToMove);
          }
          // Move the footer too
          const footerIdx = prevBlock.findIndex(r => r.type === 'footer' && r.articleId === articleIdOfMovedRoll);
          if (footerIdx !== -1) {
            const footerToMove = prevBlock[footerIdx];
            prevBlock.splice(footerIdx, 1);
            const rollIdxInLast = lastBlock.indexOf(rollToMove);
            if (rollIdxInLast !== -1) {
              lastBlock.splice(rollIdxInLast + 1, 0, footerToMove);
            } else {
              lastBlock.push(footerToMove);
            }
          }
        }
      }
    }
  }

  return blocks;
}

interface PrintPackingListProps {
  packingList: PackingList;
  clients: Client[];
  sellers: Seller[];
  providers: Provider[];
  articles: Article[];
  onClose: () => void;
}

export default function PrintPackingList({
  packingList,
  clients,
  sellers,
  providers,
  articles,
  onClose
}: PrintPackingListProps) {
  
  const client = clients.find(c => c.id === packingList.clientId);
  const seller = sellers.find(s => s.id === packingList.sellerId);

  const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || 'Artículo Eliminado';

  const totalMeters = packingList.items.reduce((acc, item) => acc + Number(item.meters || 0), 0);
  const totalRolls = packingList.items.length;

  // Active View Tab: 'packing_list' or 'guia_remision'
  const [activeView, setActiveView] = React.useState<'packing_list' | 'guia_remision'>('packing_list');

  // Guía de Remisión Electronic Fields (with highly-intelligent defaults)
  const [guiaSeries, setGuiaSeries] = React.useState('T001');
  const [guiaNumber, setGuiaNumber] = React.useState(() => {
    const digits = packingList.packingListNo.replace(/\D/g, '');
    return digits ? digits.slice(-8).padStart(8, '0') : '00000829';
  });
  
  const [fechaTraslado, setFechaTraslado] = React.useState(() => {
    if (packingList.date) {
      // If date is in format DD/MM/YYYY, convert to YYYY-MM-DD for date input
      const parts = packingList.date.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return new Date().toISOString().split('T')[0];
  });

  const [puntoPartida, setPuntoPartida] = React.useState('JR. IGNACIO COSSIO NRO. 1363 URB. AVENIDA MÉXICO LA VICTORIA LIMA LIMA');
  const [puntoLlegada, setPuntoLlegada] = React.useState(() => {
    return packingList.dispatchAddress || client?.address || '';
  });

  const [clientRuc, setClientRuc] = React.useState(() => {
    return client?.dni || '20512174389';
  });

  const [clientName, setClientName] = React.useState(() => {
    return client?.name || 'CORPORACION SEVEHER E.I.R.L.';
  });

  const [motivo, setMotivo] = React.useState('VENTA');
  const [pesoBruto, setPesoBruto] = React.useState(() => {
    // Estimating standard weight per meter for denim (e.g. 0.45 kg/m)
    return (totalMeters * 0.45).toFixed(3);
  });

  const [unidadMedida, setUnidadMedida] = React.useState('KGM');
  const [driverName, setDriverName] = React.useState('SAYAS BERROCAL VICTORIO');
  const [driverLicense, setDriverLicense] = React.useState('R41670178');
  const [vehiclePlate, setVehiclePlate] = React.useState('APK771');
  const [observaciones, setObservaciones] = React.useState(() => {
    return packingList.notes || '';
  });

  const [despachadorName, setDespachadorName] = React.useState(() => {
    return packingList.signedBy?.name || 'Paul Almacén';
  });

  const [despachadorDni, setDespachadorDni] = React.useState(() => {
    return packingList.signedBy?.dni || '42536471';
  });

  // Calculate dynamic emission date/time
  const fechaHoraEmision = React.useMemo(() => {
    const today = new Date();
    const pad = (num: number) => String(num).padStart(2, '0');
    const d = today.getDate();
    const m = today.getMonth() + 1;
    const y = today.getFullYear();
    const h = today.getHours();
    const min = today.getMinutes();
    const s = today.getSeconds();
    return `${pad(d)}/${pad(m)}/${y} ${pad(h)}:${pad(min)}:${pad(s)}`;
  }, []);

  // Format traslado date for display
  const formattedFechaTraslado = React.useMemo(() => {
    if (!fechaTraslado) return '';
    const parts = fechaTraslado.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fechaTraslado;
  }, [fechaTraslado]);

  React.useEffect(() => {
    const originalTitle = document.title;
    const handleBeforePrint = () => {
      document.title = " ";
    };
    const handleAfterPrint = () => {
      document.title = originalTitle;
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = activeView === 'guia_remision'
      ? `Guia_Remision_${guiaSeries}_${guiaNumber}`
      : `Packing_List_${packingList.packingListNo}`;
    window.focus();
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };

  const handleShareWhatsApp = () => {
    if (activeView === 'guia_remision') {
      const text = `Guía de Remisión Electrónica N° ${guiaSeries}-${guiaNumber}
Destinatario: ${clientName}
RUC: ${clientRuc}
Fecha Traslado: ${formattedFechaTraslado}
Punto de Llegada: ${puntoLlegada}
Peso Bruto: ${pesoBruto} ${unidadMedida}
Transportista: ${driverName}
Placa: ${vehiclePlate}
Total Metros: ${totalMeters.toFixed(2)} m`;

      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      return;
    }

    const guideLine = packingList.guideNumber && packingList.guideNumber.trim() !== ''
      ? `Packing List Guía N°: ${packingList.guideNumber.trim()}`
      : 'Packing List';

    const clientNameOriginal = client?.name || 'Cliente Eliminado';

    const text = `${guideLine}
Cliente: ${clientNameOriginal}
Fecha: ${packingList.date}
Total Rollos: ${packingList.totalRollsOrCuts}
Total Metros: ${totalMeters.toFixed(2)} m`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Group packing list items by Article ID for professional grouped layout
  const groupedItems = useMemo(() => {
    const groups: Record<string, PackingListItem[]> = {};
    packingList.items.forEach(item => {
      if (!groups[item.articleId]) {
        groups[item.articleId] = [];
      }
      groups[item.articleId].push(item);
    });
    return groups;
  }, [packingList.items]);

  const paginatedBlocks = useMemo(() => {
    return getPaginatedBlocks(groupedItems, getArticleName);
  }, [groupedItems, articles]);

  return (
    <div id="print-section" className="fixed inset-0 bg-app-bg/75 backdrop-blur-xs z-50 overflow-y-auto p-4 md:p-6 flex justify-center items-start print-overlay-container">
      {/* CSS rules for pure A4 printing of two clean pages */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-overlay-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            z-index: auto !important;
            display: block !important;
          }
          .print-modal-reset {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
            overflow: visible !important;
          }
          .print-scroll-container {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            max-height: none !important;
            background: transparent !important;
          }
          .print-page {
            page-break-after: always !important;
            break-after: page !important;
            border: none !important;
            box-shadow: none !important;
            padding: 12mm 15mm !important;
            margin: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            background-color: white !important;
            color: black !important;
          }
          .print-page * {
            color: black !important;
            border-color: black !important;
          }
          .print-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .aviso-importante {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .ticket-perforated::before,
          .ticket-perforated::after {
            display: none !important;
          }
          .warehouse-tag {
            border: 1px solid black !important;
            box-shadow: none !important;
            color: black !important;
            background-color: transparent !important;
          }
          @page {
            size: A4;
            margin: 0 !important;
          }
        }
      `}</style>

      <div translate="no" className={`notranslate bg-app-surface border border-app-border rounded-lg shadow-2xl w-full ${activeView === 'guia_remision' ? 'max-w-7xl' : 'max-w-4xl'} overflow-hidden print-modal-reset transition-all duration-300`}>
        {/* Header Modal Actions */}
        <div className="bg-app-surface px-6 py-4 border-b border-app-border flex flex-wrap justify-between items-center gap-4 no-print">
          <div className="flex items-center gap-3">
            <FileText className="text-app-primary" size={22} />
            <div>
              <h2 className="text-md font-bold text-app-text">
                {activeView === 'guia_remision' ? 'Guía de Remisión Electrónica' : 'Vista de Impresión Packing List'}: {packingList.packingListNo}
              </h2>
              <p className="text-[11px] text-app-text/60">
                {activeView === 'guia_remision' 
                  ? 'Guía de Remisión de formato oficial SUNAT para control de transporte terrestre y despacho de telas.'
                  : (packingList.type === 'corte' || packingList.type === 'antiguo')
                    ? 'Imprime un documento en una sola hoja A4 con dos mitades (Original con Cargo en parte superior y Copia para el receptor en parte inferior).'
                    : 'Imprime un documento de 2 hojas: Hoja 1 y Hoja 2, ambas con el Aviso Importante.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              className="px-4 py-1.5 bg-[#25D366] hover:bg-[#128C7E] text-white rounded font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs uppercase tracking-wider"
              id="btn-whatsapp-share-print"
            >
              <MessageCircle size={13} />
              WhatsApp
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-app-primary hover:bg-app-primary/95 text-white rounded font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs uppercase tracking-wider"
              id="btn-print-action"
            >
              <Printer size={13} />
              {activeView === 'guia_remision' ? 'Imprimir Guía de Remisión' : 'Imprimir Packing List'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-app-surface border border-app-border hover:bg-app-bg text-app-text rounded font-bold text-xs transition cursor-pointer uppercase tracking-wider"
              id="btn-close-print"
            >
              <X size={13} className="inline mr-1" />
              Cerrar Vista
            </button>
          </div>
        </div>

        {/* Tab Selection Row (no-print) */}
        <div className="flex border-b border-app-border bg-app-bg/55 px-6 py-2.5 gap-3 no-print shrink-0">
          <button
            onClick={() => setActiveView('packing_list')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition cursor-pointer uppercase tracking-wider ${
              activeView === 'packing_list'
                ? 'bg-app-primary text-white shadow-xs'
                : 'text-app-text/60 hover:text-app-text hover:bg-app-primary/10 border border-transparent'
            }`}
            id="tab-view-packinglist"
          >
            F-01: Packing List (Almacén)
          </button>
          <button
            onClick={() => setActiveView('guia_remision')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition cursor-pointer uppercase tracking-wider flex items-center gap-2 ${
              activeView === 'guia_remision'
                ? 'bg-app-primary text-white shadow-xs'
                : 'text-app-text/60 hover:text-app-text hover:bg-app-primary/10 border border-transparent'
            }`}
            id="tab-view-guia-remision"
          >
            F-02: Guía de Remisión / Despacho
            <span className="text-[8px] bg-red-500 text-white font-black px-1.5 py-0.5 rounded uppercase animate-pulse leading-none">NUEVO</span>
          </button>
        </div>

        {/* Scrollable Container for On-Screen Visualizing */}
        <div className="p-4 overflow-y-auto max-h-[80vh] bg-app-bg/90 space-y-4 print-scroll-container">
          {activeView === 'guia_remision' ? (
            /* Guia de Remisión dual-column panel layout */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Sidebar Config Panel (no-print) */}
              <div className="lg:col-span-4 bg-app-surface border border-app-border rounded-xl p-5 space-y-4 no-print text-app-text shadow-sm">
                <div className="border-b border-app-border/40 pb-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-app-primary animate-pulse"></div>
                  <div>
                    <h3 className="text-xs font-extrabold text-app-primary uppercase tracking-wider">Datos de Traslado</h3>
                    <p className="text-[10px] text-app-text/60 mt-0.5">Configure la guía antes de generar el impreso.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Serie</label>
                    <input 
                      type="text" 
                      value={guiaSeries} 
                      onChange={e => setGuiaSeries(e.target.value.toUpperCase())} 
                      className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-bold uppercase" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Correlativo</label>
                    <input 
                      type="text" 
                      value={guiaNumber} 
                      onChange={e => setGuiaNumber(e.target.value)} 
                      className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-mono font-bold" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Fecha de Traslado</label>
                  <input 
                    type="date" 
                    value={fechaTraslado} 
                    onChange={e => setFechaTraslado(e.target.value)} 
                    className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-bold" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Punto de Partida</label>
                  <textarea 
                    value={puntoPartida} 
                    onChange={e => setPuntoPartida(e.target.value)} 
                    rows={2} 
                    className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden resize-none leading-normal" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Punto de Llegada (Despacho)</label>
                  <textarea 
                    value={puntoLlegada} 
                    onChange={e => setPuntoLlegada(e.target.value)} 
                    rows={2} 
                    className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden resize-none leading-normal font-bold" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">RUC Destinatario</label>
                    <input 
                      type="text" 
                      value={clientRuc} 
                      onChange={e => setClientRuc(e.target.value)} 
                      className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-mono" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Peso Bruto (KGM)</label>
                    <input 
                      type="text" 
                      value={pesoBruto} 
                      onChange={e => setPesoBruto(e.target.value)} 
                      className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-mono font-bold" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Destinatario (Cliente)</label>
                  <input 
                    type="text" 
                    value={clientName} 
                    onChange={e => setClientName(e.target.value)} 
                    className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-bold" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Motivo Traslado</label>
                  <select 
                    value={motivo} 
                    onChange={e => setMotivo(e.target.value)} 
                    className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-bold"
                  >
                    <option value="VENTA">VENTA</option>
                    <option value="TRASLADO ENTRE ESTABLECIMIENTOS">TRASLADO ENTRE ESTABLECIMIENTOS</option>
                    <option value="COMPRA">COMPRA</option>
                    <option value="CONSIGNACION">CONSIGNACIÓN</option>
                    <option value="DEVOLUCION">DEVOLUCIÓN</option>
                    <option value="OTROS">OTROS</option>
                  </select>
                </div>

                <div className="border-t border-app-border/40 pt-3 space-y-3">
                  <h4 className="text-[10px] font-black text-app-primary uppercase tracking-wider">Chofer & Vehículo</h4>
                  <div>
                    <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Nombre Transportista</label>
                    <input 
                      type="text" 
                      value={driverName} 
                      onChange={e => setDriverName(e.target.value)} 
                      className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-semibold" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Licencia Conducir</label>
                      <input 
                        type="text" 
                        value={driverLicense} 
                        onChange={e => setDriverLicense(e.target.value)} 
                        className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-mono" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Placa Vehicular</label>
                      <input 
                        type="text" 
                        value={vehiclePlate} 
                        onChange={e => setVehiclePlate(e.target.value.toUpperCase())} 
                        className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-mono font-bold uppercase" 
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-app-border/40 pt-3 space-y-3">
                  <h4 className="text-[10px] font-black text-app-primary uppercase tracking-wider">Firmas Autorizadas</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Despachador</label>
                      <input 
                        type="text" 
                        value={despachadorName} 
                        onChange={e => setDespachadorName(e.target.value)} 
                        className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-medium" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">DNI Despachador</label>
                      <input 
                        type="text" 
                        value={despachadorDni} 
                        onChange={e => setDespachadorDni(e.target.value)} 
                        className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden font-mono" 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-app-text/50 uppercase tracking-wider mb-1">Observaciones / Notas</label>
                  <textarea 
                    value={observaciones} 
                    onChange={e => setObservaciones(e.target.value)} 
                    rows={2} 
                    className="w-full px-2.5 py-1.5 text-xs bg-app-bg border border-app-border rounded focus:border-app-primary focus:outline-hidden resize-none leading-normal font-mono" 
                  />
                </div>
              </div>

              {/* Printable Canvas Section */}
              <div className="lg:col-span-8 w-full flex justify-center">
                <GuiaRemisionPrintSheet
                  guiaSeries={guiaSeries}
                  guiaNumber={guiaNumber}
                  fechaHoraEmision={fechaHoraEmision}
                  formattedFechaTraslado={formattedFechaTraslado}
                  puntoPartida={puntoPartida}
                  puntoLlegada={puntoLlegada}
                  clientRuc={clientRuc}
                  clientName={clientName}
                  motivo={motivo}
                  pesoBruto={pesoBruto}
                  unidadMedida={unidadMedida}
                  driverName={driverName}
                  driverLicense={driverLicense}
                  vehiclePlate={vehiclePlate}
                  observaciones={observaciones}
                  despachadorName={despachadorName}
                  despachadorDni={despachadorDni}
                  packingList={packingList}
                  getArticleName={getArticleName}
                  groupedItems={groupedItems}
                />
              </div>

            </div>
          ) : (
            <>
              {window.self !== window.top && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4 text-xs text-red-800 dark:text-red-300 flex flex-col gap-2 no-print shadow-xs animate-pulse">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={18} />
                    <p className="font-bold text-sm">
                      ¡Atención! Bloqueo de impresión detectado (Vista Previa de AI Studio)
                    </p>
                  </div>
                  <p className="leading-relaxed">
                    Los navegadores modernos <strong>bloquean</strong> las ventanas de impresión (<code className="font-mono bg-red-100 dark:bg-red-950/40 px-1 rounded text-red-950 dark:text-red-300">window.print()</code>) cuando la aplicación se ejecuta dentro de un marco o <strong>iFrame</strong> por razones de seguridad.
                  </p>
                  <p className="font-medium">
                    👉 <strong>Solución:</strong> Haga clic en el botón con el icono de la flecha inclinada <strong>"Open in new tab"</strong> (Abrir en pestaña nueva) ubicado en la esquina superior derecha del panel de vista previa de AI Studio, o acceda directamente usando los enlaces de desarrollo compartidos. Una vez abierto en su propia pestaña, el botón de impresión funcionará a la perfección.
                  </p>
                </div>
              )}

              <div className="bg-app-primary/5 border border-app-primary/20 rounded-lg p-3 text-xs text-app-primary flex items-center gap-2 no-print">
                <AlertTriangle className="text-app-primary shrink-0" size={16} />
                <p>
                  <strong>Sugerencia de Impresión:</strong> Para un acabado perfecto, asegúrese de activar <strong>"Gráficos de fondo"</strong> en la configuración de su navegador.
                </p>
              </div>

              {(packingList.type === 'corte' || packingList.type === 'antiguo') ? (
                <CortePrintSheet
                  packingList={packingList}
                  client={client}
                  seller={seller}
                  groupedItems={groupedItems}
                  getArticleName={getArticleName}
                  totalRolls={totalRolls}
                  totalMeters={totalMeters}
                  providers={providers}
                />
              ) : (
                <>
                  {/* COPY 1: ORIGINAL CLIENT COPY */}
                  {paginatedBlocks.map((block, pageIdx) => (
                    <PaginatedSinglePrintPage
                      key={`cli-${pageIdx}`}
                      title="PACKING LIST"
                      packingList={packingList}
                      client={client}
                      seller={seller}
                      block={block}
                      getArticleName={getArticleName}
                      totalRolls={totalRolls}
                      totalMeters={totalMeters}
                      providers={providers}
                      isLastPage={pageIdx === paginatedBlocks.length - 1}
                      bottomContent={
                        <div className="aviso-importante mt-4 border border-app-border rounded-lg p-2.5 bg-app-surface text-app-text print:text-black print:border-black print:bg-white">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-app-primary mb-1.5 text-center border-b border-app-border pb-0.5 py-0.5 rounded print:text-black print:border-black">
                            AVISO IMPORTANTE
                          </h3>
                          <div className="text-[8px] font-medium leading-normal uppercase">
                            <p className="mb-1">
                              1. EL CLIENTE DEBERÁ <strong className="font-extrabold">FOLIAR O NUMERAR</strong> LAS CAPAS TENDIDAS DE TELA, INDEPENDIENTEMENTE DE QUE SEA O NO DEL MISMO LOTE. ELLO, PARA CONSTATAR EL COLOR Y ENCOGIMIENTO DE LA MERCANCÍA.
                            </p>
                            <p className="mb-1">
                              2. <strong className="font-extrabold">NO CORTE</strong> EL ROLLO ANTES DE COMPROBAR: CALIDAD, CANTIDAD DE METRAJE, SOLIDEZ DE COLOR, ETC.
                            </p>
                            <p className="font-black text-center pt-1 border-t border-app-border print:border-black">
                              DE NO CUMPLIR EL CLIENTE CON LOS 2 PUNTOS SEÑALADOS ANTERIORMENTE, ABSTENERSE DE RECLAMOS. GRACIAS POR SU COOPERACIÓN.
                            </p>
                          </div>
                        </div>
                      }
                    />
                  ))}

                  {/* COPY 2: WAREHOUSE COPY / COPIA CARGO */}
                  {paginatedBlocks.map((block, pageIdx) => (
                    <PaginatedSinglePrintPage
                      key={`war-${pageIdx}`}
                      title="PACKING LIST"
                      packingList={packingList}
                      client={client}
                      seller={seller}
                      block={block}
                      getArticleName={getArticleName}
                      totalRolls={totalRolls}
                      totalMeters={totalMeters}
                      providers={providers}
                      isLastPage={pageIdx === paginatedBlocks.length - 1}
                      bottomContent={
                        <div className="aviso-importante mt-4 border border-app-border rounded-lg p-2.5 bg-app-surface text-app-text print:text-black print:border-black print:bg-white">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-app-primary mb-1.5 text-center border-b border-app-border pb-0.5 py-0.5 rounded print:text-black print:border-black">
                            AVISO IMPORTANTE
                          </h3>
                          <div className="text-[8px] font-medium leading-normal uppercase">
                            <p className="mb-1">
                              1. EL CLIENTE DEBERÁ <strong className="font-extrabold">FOLIAR O NUMERAR</strong> LAS CAPAS TENDIDAS DE TELA, INDEPENDIENTEMENTE DE QUE SEA O NO DEL MISMO LOTE. ELLO, PARA CONSTATAR EL COLOR Y ENCOGIMIENTO DE LA MERCANCÍA.
                            </p>
                            <p className="mb-1">
                              2. <strong className="font-extrabold">NO CORTE</strong> EL ROLLO ANTES DE COMPROBAR: CALIDAD, CANTIDAD DE METRAJE, SOLIDEZ DE COLOR, ETC.
                            </p>
                            <p className="font-black text-center pt-1 border-t border-app-border print:border-black">
                              DE NO CUMPLIR EL CLIENTE CON LOS 2 PUNTOS SEÑALADOS ANTERIORMENTE, ABSTENERSE DE RECLAMOS. GRACIAS POR SU COOPERACIÓN.
                            </p>
                          </div>
                        </div>
                      }
                    />
                  ))}
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}

interface PaginatedSinglePrintPageProps {
  key?: string;
  title: string;
  packingList: PackingList;
  client: Client | undefined;
  seller: Seller | undefined;
  block: PrintableRow[];
  getArticleName: (id: string) => string;
  totalRolls: number;
  totalMeters: number;
  providers: Provider[];
  isLastPage: boolean;
  bottomContent?: React.ReactNode;
}

function PaginatedSinglePrintPage({
  title,
  packingList,
  client,
  seller,
  block,
  getArticleName,
  totalRolls,
  totalMeters,
  providers,
  isLastPage,
  bottomContent
}: PaginatedSinglePrintPageProps) {
  const firstItemProviderId = packingList.items[0]?.providerId;
  const activeProvider = providers.find(p => p.id === firstItemProviderId) || null;

  const showLot = activeProvider ? activeProvider.hasLot : true;
  const showPartida = activeProvider ? activeProvider.hasPartida : true;
  const hasRollNo = activeProvider ? activeProvider.hasRollNo : false;
  const hasTono = activeProvider ? !!activeProvider.hasTono : false;
  const hasWidth = activeProvider ? !!activeProvider.hasWidth : false;
  const hasWeight = activeProvider ? !!activeProvider.hasWeight : false;

  const colSpanHeader = 2 
    + (showLot ? 1 : 0) 
    + (showPartida ? 1 : 0) 
    + (hasTono ? 1 : 0)
    + (hasWidth ? 1 : 0)
    + (hasWeight ? 1 : 0);

  const colSpanSummary = 1 
    + (showLot ? 1 : 0) 
    + (showPartida ? 1 : 0) 
    + (hasTono ? 1 : 0)
    + (hasWidth ? 1 : 0)
    + (hasWeight ? 1 : 0);

  return (
    <div translate="no" className="notranslate ticket-perforated bg-app-surface text-app-text p-8 border border-app-border rounded-xl shadow-lg font-sans max-w-3xl mx-auto my-2 print-page print:border-none print:shadow-none print:p-0 print:my-0 print:bg-white print:min-h-[296mm] flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-display text-app-primary">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <img 
              src="/logo-juditex.png" 
              alt="Juditex" 
              className="h-12 w-auto object-contain print:opacity-100" 
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Client and Sales Representative at the same height */}
        <div className="flex justify-between items-start text-xs border-b border-app-border pb-3 mb-6">
          <div className="space-y-1">
            <p className="font-bold">
              CLIENTE: <span className="font-normal uppercase text-app-text/90">{client?.name || 'Cliente Eliminado'}</span>
            </p>
            {packingList.dispatchAddress && (
              <p className="font-bold mt-1">
                DESTINO: <span className="font-normal uppercase text-app-text/90">{packingList.dispatchAddress}</span>
              </p>
            )}
            <p className="font-bold mt-1">
              GUÍA N°: <span className="font-normal uppercase text-app-text/90">
                {packingList.guideNumber || '___________'}
              </span>
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="font-bold">
              VENDEDOR: <span className="font-normal uppercase text-app-text/90">{seller?.name || 'Vendedor Autorizado'}</span>
            </p>
            <p className="font-bold">
              FECHA: <span className="font-normal font-mono text-app-text/80">{packingList.date}</span>
            </p>
          </div>
        </div>

        {/* Elegant Grouped Articles Table */}
        <div className="mb-6">
          <table className="w-full text-left border-collapse border-b border-app-border text-xs">
            <thead>
              <tr className="border-b-2 border-app-border text-[10px] text-app-text uppercase font-bold tracking-wider">
                <th className="py-1.5 px-1 w-2/5">
                  {hasRollNo ? 'Nº ROLLO' : 'ITEM'}
                </th>
                {showLot && <th className="py-1.5 px-1 text-center w-24">LOTE</th>}
                {showPartida && <th className="py-1.5 px-1 text-center w-28">PARTIDA</th>}
                {hasTono && <th className="py-1.5 px-1 text-center w-20">TONO</th>}
                {hasWidth && <th className="py-1.5 px-1 text-center w-20">ANCHO</th>}
                {hasWeight && <th className="py-1.5 px-1 text-center w-20">PESO</th>}
                <th className="py-1.5 px-1 text-right w-32">METRAJE</th>
              </tr>
            </thead>
            <tbody>
              {block.map((row, idx) => {
                if (row.type === 'header') {
                  return (
                    <tr key={`h-${row.articleId}-${idx}`} className="border-b border-app-border font-bold bg-app-bg/25 print:bg-white">
                      <td colSpan={colSpanHeader} className="py-1.5 px-1 text-app-primary uppercase text-[11px] tracking-tight font-bold">
                        {row.articleName}
                      </td>
                    </tr>
                  );
                } else if (row.type === 'roll') {
                  const item = row.item!;
                  return (
                    <tr key={`r-${item.id || idx}`} className="border-b border-app-border/40 hover:bg-app-bg/10">
                      <td className="py-1 px-1 font-mono text-[10.5px] pl-4 font-bold">
                        {hasRollNo ? (item.rollNumber || '-') : ((row.index ?? 0) + 1)}
                      </td>
                      {showLot && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.lot || '-'}</td>}
                      {showPartida && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.partida || '-'}</td>}
                      {hasTono && <td className="py-1 px-1 text-center font-mono text-[11px] font-bold text-app-primary uppercase">{item.tono || '-'}</td>}
                      {hasWidth && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.width ? `${item.width} m` : '-'}</td>}
                      {hasWeight && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.weight ? `${item.weight} kg` : '-'}</td>}
                      <td className="py-1 px-1 text-right font-mono font-bold text-[11px]">{Number(item.meters).toFixed(2)} m</td>
                    </tr>
                  );
                } else if (row.type === 'footer') {
                  return (
                    <tr key={`f-${row.articleId}-${idx}`} className="border-b-2 border-app-border font-bold text-[11px] bg-app-bg/10 print:bg-white">
                      <td colSpan={colSpanSummary} className="py-2 px-1 uppercase text-right tracking-tight font-bold text-app-text/75">
                        {row.articleName} -- Cantidad: {row.groupLength} | Total:
                      </td>
                      <td className="py-2 px-1 text-right font-mono text-app-primary font-black">
                        {(row.articleTotalMeters ?? 0).toFixed(2)} m
                      </td>
                    </tr>
                  );
                }
                return null;
              })}
            </tbody>
          </table>

          {/* Grand Totals Section */}
          {isLastPage && (
            <div className="flex flex-col items-end justify-end mt-3 text-xs font-bold space-y-1">
              <p className="uppercase tracking-tight">TOTAL ROLLOS: <span className="font-mono font-black text-sm text-app-secondary">{totalRolls}</span></p>
              <p className="uppercase tracking-tight font-display text-app-primary">TOTAL METROS: <span className="font-mono font-black text-md">{totalMeters.toFixed(2)} m</span></p>
            </div>
          )}
        </div>
      </div>

      {isLastPage && bottomContent}
    </div>
  );
}

interface SinglePrintPageProps {
  title: string;
  packingList: PackingList;
  client: Client | undefined;
  seller: Seller | undefined;
  groupedItems: Record<string, PackingListItem[]>;
  getArticleName: (id: string) => string;
  totalRolls: number;
  totalMeters: number;
  bottomContent: React.ReactNode;
  providers: Provider[];
}

function SinglePrintPage({
  title,
  packingList,
  client,
  seller,
  groupedItems,
  getArticleName,
  totalRolls,
  totalMeters,
  bottomContent,
  providers
}: SinglePrintPageProps) {
  const firstItemProviderId = packingList.items[0]?.providerId;
  const activeProvider = providers.find(p => p.id === firstItemProviderId) || null;

  const showLot = activeProvider ? activeProvider.hasLot : true;
  const showPartida = activeProvider ? activeProvider.hasPartida : true;
  const hasRollNo = activeProvider ? activeProvider.hasRollNo : false;
  const hasTono = activeProvider ? !!activeProvider.hasTono : false;
  const hasWidth = activeProvider ? !!activeProvider.hasWidth : false;
  const hasWeight = activeProvider ? !!activeProvider.hasWeight : false;

  return (
    <div translate="no" className="notranslate ticket-perforated bg-app-surface text-app-text p-8 border border-app-border rounded-xl shadow-lg font-sans max-w-3xl mx-auto my-2 min-h-[296mm] flex flex-col justify-between print-page print:border-none print:shadow-none print:p-0 print:my-0 print:bg-white">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-display text-app-primary">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="warehouse-tag">
              GUÍA N°: {packingList.guideNumber || '___________'}
            </span>
            <img 
              src="/logo-juditex.png" 
              alt="Juditex" 
              className="h-12 w-auto object-contain print:opacity-100" 
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Client and Sales Representative at the same height */}
        <div className="flex justify-between items-start text-xs border-b border-app-border pb-3 mb-6">
          <div className="space-y-1">
            <p className="font-bold">
              CLIENTE: <span className="font-normal uppercase text-app-text/90">{client?.name || 'Cliente Eliminado'}</span>
            </p>
            {packingList.dispatchAddress && (
              <p className="font-bold mt-1">
                DESTINO: <span className="font-normal uppercase text-app-text/90">{packingList.dispatchAddress}</span>
              </p>
            )}
          </div>
          <div className="text-right space-y-1">
            <p className="font-bold">
              VENDEDOR: <span className="font-normal uppercase text-app-text/90">{seller?.name || 'Vendedor Autorizado'}</span>
            </p>
            <p className="font-bold">
              FECHA: <span className="font-normal font-mono text-app-text/80">{packingList.date}</span>
            </p>
          </div>
        </div>

        {/* Elegant Grouped Articles Table */}
        <div className="mb-6">
          <table className="w-full text-left border-collapse border-b border-app-border text-xs">
            <thead>
              <tr className="border-b-2 border-app-border text-[10px] text-app-text uppercase font-bold tracking-wider">
                <th className="py-1.5 px-1 w-2/5">
                  {hasRollNo ? 'Nº ROLLO' : 'ITEM'}
                </th>
                {showLot && <th className="py-1.5 px-1 text-center w-24">LOTE</th>}
                {showPartida && <th className="py-1.5 px-1 text-center w-28">PARTIDA</th>}
                {hasTono && <th className="py-1.5 px-1 text-center w-20">TONO</th>}
                {hasWidth && <th className="py-1.5 px-1 text-center w-20">ANCHO</th>}
                {hasWeight && <th className="py-1.5 px-1 text-center w-20">PESO</th>}
                <th className="py-1.5 px-1 text-right w-32">METRAJE</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedItems).map(articleId => {
                const groupItems = groupedItems[articleId];
                const articleName = getArticleName(articleId);
                const articleTotalMeters = groupItems.reduce((acc, item) => acc + Number(item.meters || 0), 0);
                
                const colSpanHeader = 2 
                  + (showLot ? 1 : 0) 
                  + (showPartida ? 1 : 0) 
                  + (hasTono ? 1 : 0)
                  + (hasWidth ? 1 : 0)
                  + (hasWeight ? 1 : 0);

                const colSpanSummary = 1 
                  + (showLot ? 1 : 0) 
                  + (showPartida ? 1 : 0) 
                  + (hasTono ? 1 : 0)
                  + (hasWidth ? 1 : 0)
                  + (hasWeight ? 1 : 0);

                return (
                  <React.Fragment key={articleId}>
                    {/* Article Name Header Row */}
                    <tr className="border-b border-app-border font-bold bg-app-bg/25 print:bg-white">
                      <td colSpan={colSpanHeader} className="py-1.5 px-1 text-app-primary uppercase text-[11px] tracking-tight">
                        {articleName}
                      </td>
                    </tr>
                    
                    {/* Individual Roll/Cut metraje entries */}
                    {groupItems.map((item, idx) => (
                      <tr key={item.id || idx} className="border-b border-app-border/40 hover:bg-app-bg/10">
                        <td className="py-1 px-1 font-mono text-[10.5px] pl-4 font-bold">
                          {hasRollNo ? (item.rollNumber || '-') : (idx + 1)}
                        </td>
                        {showLot && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.lot || '-'}</td>}
                        {showPartida && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.partida || '-'}</td>}
                        {hasTono && <td className="py-1 px-1 text-center font-mono text-[11px] font-bold text-app-primary uppercase">{item.tono || '-'}</td>}
                        {hasWidth && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.width ? `${item.width} m` : '-'}</td>}
                        {hasWeight && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.weight ? `${item.weight} kg` : '-'}</td>}
                        <td className="py-1 px-1 text-right font-mono font-bold text-[11px]">{Number(item.meters).toFixed(2)} m</td>
                      </tr>
                    ))}
                    
                    {/* Article Group Summary Row */}
                    <tr className="border-b-2 border-app-border font-bold text-[11px] bg-app-bg/10 print:bg-white">
                      <td colSpan={colSpanSummary} className="py-2 px-1 uppercase text-right tracking-tight font-bold text-app-text/75">
                        {articleName} -- Cantidad: {groupItems.length} | Total:
                      </td>
                      <td className="py-2 px-1 text-right font-mono text-app-primary font-black">
                        {articleTotalMeters.toFixed(2)} m
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Grand Totals Section */}
          <div className="flex flex-col items-end justify-end mt-3 text-xs font-bold space-y-1">
            <p className="uppercase tracking-tight">TOTAL ROLLOS: <span className="font-mono font-black text-sm text-app-secondary">{totalRolls}</span></p>
            <p className="uppercase tracking-tight font-display text-app-primary">TOTAL METROS: <span className="font-mono font-black text-md">{totalMeters.toFixed(2)} m</span></p>
          </div>
        </div>
      </div>

      {bottomContent}
    </div>
  );
}

interface CortePrintSheetProps {
  packingList: PackingList;
  client: Client | undefined;
  seller: Seller | undefined;
  groupedItems: Record<string, PackingListItem[]>;
  getArticleName: (id: string) => string;
  totalRolls: number;
  totalMeters: number;
  providers: Provider[];
}

function CortePrintSheet({
  packingList,
  client,
  seller,
  groupedItems,
  getArticleName,
  totalRolls,
  totalMeters,
  providers
}: CortePrintSheetProps) {
  const firstItemProviderId = packingList.items[0]?.providerId;
  const activeProvider = providers.find(p => p.id === firstItemProviderId) || null;

  const showLot = activeProvider ? activeProvider.hasLot : true;
  const showPartida = activeProvider ? activeProvider.hasPartida : true;

  return (
    <div translate="no" className="notranslate ticket-perforated bg-app-surface text-app-text px-6 py-4 border border-app-border rounded-xl shadow-lg font-sans max-w-3xl mx-auto my-2 h-[296mm] max-h-[296mm] flex flex-col justify-between print-page print:border-none print:shadow-none print:p-0 print:my-0 print:bg-white box-border">
      
      {/* TOP HALF - EXACTLY 50% */}
      <div className="h-[50%] flex flex-col justify-between pb-4 border-b border-dashed border-app-border relative box-border overflow-hidden">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-display text-app-primary">PACKING LIST</h2>
            </div>
            <img 
              src="/logo-juditex.png" 
              alt="Juditex" 
              className="h-10 w-auto object-contain print:opacity-100" 
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Client / Seller / Date details - Identical layout on both halves */}
          <div className="grid grid-cols-2 gap-4 text-[9.5px] py-1 mb-1.5 border-b border-app-border">
            <div>
              <p className="font-bold">
                CLIENTE: <span className="font-normal uppercase text-app-text/90">{client?.name || 'Cliente Eliminado'}</span>
              </p>
              {packingList.dispatchAddress && (
                <p className="font-bold mt-0.5">
                  DESTINO: <span className="font-normal uppercase text-app-text/90">{packingList.dispatchAddress}</span>
                </p>
              )}
              <p className="font-bold mt-0.5">
                GUÍA N°: <span className="font-normal uppercase text-app-text/90">
                  {packingList.guideNumber || '___________'}
                </span>
              </p>
              <p className="font-bold mt-0.5">
                FECHA: <span className="font-normal font-mono text-app-text/80">{packingList.date}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">
                VENDEDOR: <span className="font-normal uppercase text-app-text/90">{seller?.name || 'Vendedor Autorizado'}</span>
              </p>
            </div>
          </div>

          {/* Side-by-Side: Metrajes on the Left, CARGO on the Right */}
          <div className="grid grid-cols-12 gap-4 items-stretch">
            
            {/* LEFT COLUMN: Packing list details and metrajes grid (col-span-7) */}
            <div className="col-span-7 flex flex-col justify-between">
              <div className="space-y-2">
                {Object.keys(groupedItems).map(articleId => {
                  const groupItems = groupedItems[articleId];
                  const articleName = getArticleName(articleId);
                  const articleTotalMeters = groupItems.reduce((acc, item) => acc + Number(item.meters || 0), 0);
                  
                  const uniqueLots = Array.from(new Set(groupItems.map(item => item.lot).filter(Boolean)));
                  const uniquePartidas = Array.from(new Set(groupItems.map(item => item.partida).filter(Boolean)));
                  const lotText = showLot && uniqueLots.length > 0 ? `LOTE: ${uniqueLots.join(', ')}` : '';
                  const partidaText = showPartida && uniquePartidas.length > 0 ? `PARTIDA: ${uniquePartidas.join(', ')}` : '';
                  const attributesText = [lotText, partidaText].filter(Boolean).join(' | ');

                  return (
                    <div key={articleId} className="text-[9px]">
                      <div className="font-extrabold text-app-primary uppercase tracking-tight text-[9.5px] mb-0.5">
                        {articleName} {attributesText ? `(${attributesText})` : ''}
                      </div>
                      
                      {/* Grid of metrajes (clean, aligned columns) */}
                      <div className="grid grid-cols-6 gap-x-2 gap-y-0.5 py-0.5 font-mono text-[9px] text-left">
                        {groupItems.map((item, idx) => {
                          const hasTonoValue = activeProvider?.hasTono && item.tono;
                          return (
                            <div key={item.id || idx} className="py-0.2">
                              <span className="font-bold">{Number(item.meters).toFixed(2)}</span>
                              {hasTonoValue && (
                                <span className="text-[7.5px] font-extrabold bg-app-primary text-white px-0.5 rounded ml-1">
                                  {item.tono}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-right font-bold text-app-secondary text-[9px] mt-0.5 pr-2">
                        Subtotal: {articleTotalMeters.toFixed(2)} m
                      </div>
                    </div>
                  );
                })}
                {packingList.type === 'corte' && packingList.notes && (
                  <div className="mt-2 border border-app-border rounded p-1.5 bg-app-bg/20 print:bg-white text-[8px] leading-snug">
                    <span className="font-bold text-app-primary">NOTA:</span> {packingList.notes}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: CARGO Box (col-span-5) - Larger size & matches original style perfectly, but in black and white */}
            <div className="col-span-5 self-stretch flex flex-col">
              <div className="border-2 border-app-primary rounded-xl p-3 text-app-text flex flex-col justify-between bg-app-bg/10 print:bg-white h-full min-h-[140px]">
                <h3 className="text-sm font-display text-center tracking-widest uppercase mb-3 text-app-primary">
                  CARGO DE RECEPCIÓN
                </h3>
                <div className="space-y-3 text-[9px] font-extrabold flex-1 flex flex-col justify-between">
                  <div className="space-y-0.5">
                    <span className="uppercase tracking-wider text-[8px] text-app-text/60">Nombre:</span>
                    <div className="border-b border-app-border h-4 w-full"></div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="uppercase tracking-wider text-[8px] text-app-text/60">DNI:</span>
                    <div className="border-b border-app-border h-4 w-full"></div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="uppercase tracking-wider text-[8px] text-app-text/60">Fecha de Recepción:</span>
                    <div className="border-b border-app-border h-4 w-full"></div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="uppercase tracking-wider text-[8px] text-app-text/60">Firma:</span>
                    <div className="border-b border-app-border h-5 w-full mt-1"></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Inline Summary for Top Half (Only Metrics to prevent Client/Seller repetition) */}
        <div>
          <div className="border-t border-app-border pt-1.5 mt-2 text-[10px] font-black uppercase">
            <div className="flex justify-between items-center px-2">
              <p className="font-display text-app-primary">TOTAL METROS: <span className="font-mono text-xs">{totalMeters.toFixed(2)} m</span></p>
              <p className="font-display text-app-secondary">CANTIDAD DE ROLLOS: <span className="font-mono text-xs">{totalRolls}</span></p>
            </div>
          </div>

          {packingList.type === 'antiguo' && (
            <div className="aviso-importante mt-4 border border-app-border rounded-lg p-2.5 bg-app-surface text-app-text print:text-black print:border-black print:bg-white">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-app-primary mb-1.5 text-center border-b border-app-border pb-0.5 py-0.5 rounded print:text-black print:border-black">
                AVISO IMPORTANTE
              </h3>
              <div className="text-[8px] font-medium leading-normal uppercase">
                <p className="mb-1">
                  1. EL CLIENTE DEBERÁ <strong className="font-extrabold">FOLIAR O NUMERAR</strong> LAS CAPAS TENDIDAS DE TELA, INDEPENDIENTEMENTE DE QUE SEA O NO DEL MISMO LOTE. ELLO, PARA CONSTATAR EL COLOR Y ENCOGIMIENTO DE LA MERCANCÍA.
                </p>
                <p className="mb-1">
                  2. <strong className="font-extrabold">NO CORTE</strong> EL ROLLO ANTES DE COMPROBAR: CALIDAD, CANTIDAD DE METRAJE, SOLIDEZ DE COLOR, ETC.
                </p>
                <p className="font-black text-center pt-1 border-t border-app-border print:border-black">
                  DE NO CUMPLIR EL CLIENTE CON LOS 2 PUNTOS SEÑALADOS ANTERIORMENTE, ABSTENERSE DE RECLAMOS. GRACIAS POR SU COOPERACIÓN.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM HALF - EXACTLY 50% */}
      <div className="h-[50%] flex flex-col justify-between pt-4 box-border overflow-hidden">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-display text-app-primary">PACKING LIST</h2>
            </div>
            <img 
              src="/logo-juditex.png" 
              alt="Juditex" 
              className="h-10 w-auto object-contain print:opacity-100" 
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Client / Seller / Date details - Identical layout on both halves */}
          <div className="grid grid-cols-2 gap-4 text-[9.5px] py-1 mb-1.5 border-b border-app-border">
            <div>
              <p className="font-bold">
                CLIENTE: <span className="font-normal uppercase text-app-text/90">{client?.name || 'Cliente Eliminado'}</span>
              </p>
              {packingList.dispatchAddress && (
                <p className="font-bold mt-0.5">
                  DESTINO: <span className="font-normal uppercase text-app-text/90">{packingList.dispatchAddress}</span>
                </p>
              )}
              <p className="font-bold mt-0.5">
                GUÍA N°: <span className="font-normal uppercase text-app-text/90">
                  {packingList.guideNumber || '___________'}
                </span>
              </p>
              <p className="font-bold mt-0.5">
                FECHA: <span className="font-normal font-mono text-app-text/80">{packingList.date}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">
                VENDEDOR: <span className="font-normal uppercase text-app-text/90">{seller?.name || 'Vendedor Autorizado'}</span>
              </p>
            </div>
          </div>

          {/* Detailed Metrajes Grid for Bottom Half (Full width representation) */}
          <div className="space-y-2">
            {Object.keys(groupedItems).map(articleId => {
              const groupItems = groupedItems[articleId];
              const articleName = getArticleName(articleId);
              const articleTotalMeters = groupItems.reduce((acc, item) => acc + Number(item.meters || 0), 0);
              
              const uniqueLots = Array.from(new Set(groupItems.map(item => item.lot).filter(Boolean)));
              const uniquePartidas = Array.from(new Set(groupItems.map(item => item.partida).filter(Boolean)));
              const lotText = showLot && uniqueLots.length > 0 ? `LOTE: ${uniqueLots.join(', ')}` : '';
              const partidaText = showPartida && uniquePartidas.length > 0 ? `PARTIDA: ${uniquePartidas.join(', ')}` : '';
              const attributesText = [lotText, partidaText].filter(Boolean).join(' | ');

              return (
                <div key={articleId} className="text-[9px]">
                  <div className="font-extrabold text-app-primary uppercase tracking-tight text-[9.5px] mb-0.5">
                    {articleName} {attributesText ? `(${attributesText})` : ''}
                  </div>
                  
                  {/* Grid of metrajes (clean, aligned columns - full 8 columns wide for bottom part) */}
                  <div className="grid grid-cols-8 gap-x-2 gap-y-0.5 py-0.5 font-mono text-[9px] text-left">
                    {groupItems.map((item, idx) => {
                      const hasTonoValue = activeProvider?.hasTono && item.tono;
                      return (
                        <div key={item.id || idx} className="py-0.2">
                          <span className="font-bold">{Number(item.meters).toFixed(2)}</span>
                          {hasTonoValue && (
                            <span className="text-[7.5px] font-extrabold bg-app-primary text-white px-0.5 rounded ml-1">
                              {item.tono}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-right font-bold text-app-secondary text-[9px] mt-0.5 pr-2">
                    Subtotal: {articleTotalMeters.toFixed(2)} m
                  </div>
                </div>
              );
            })}
            {packingList.type === 'corte' && packingList.notes && (
              <div className="mt-2 border border-app-border rounded p-1.5 bg-app-bg/20 print:bg-white text-[8px] leading-snug">
                <span className="font-bold text-app-primary">NOTA:</span> {packingList.notes}
              </div>
            )}
          </div>
        </div>

        <div>
          {/* Inline Summary for Bottom Half (Only Metrics to prevent Client/Seller repetition) */}
          <div className="border-t border-app-border pt-1.5 text-[10px] font-black uppercase">
            <div className="flex justify-between items-center px-2">
              <p className="font-display text-app-primary">TOTAL METROS: <span className="font-mono text-xs">{totalMeters.toFixed(2)} m</span></p>
              <p className="font-display text-app-secondary">CANTIDAD DE ROLLOS: <span className="font-mono text-xs">{totalRolls}</span></p>
            </div>
          </div>

          {packingList.type === 'antiguo' && (
            <div className="aviso-importante mt-4 border border-app-border rounded-lg p-2.5 bg-app-surface text-app-text print:text-black print:border-black print:bg-white">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-app-primary mb-1.5 text-center border-b border-app-border pb-0.5 py-0.5 rounded print:text-black print:border-black">
                AVISO IMPORTANTE
              </h3>
              <div className="text-[8px] font-medium leading-normal uppercase">
                <p className="mb-1">
                  1. EL CLIENTE DEBERÁ <strong className="font-extrabold">FOLIAR O NUMERAR</strong> LAS CAPAS TENDIDAS DE TELA, INDEPENDIENTEMENTE DE QUE SEA O NO DEL MISMO LOTE. ELLO, PARA CONSTATAR EL COLOR Y ENCOGIMIENTO DE LA MERCANCÍA.
                </p>
                <p className="mb-1">
                  2. <strong className="font-extrabold">NO CORTE</strong> EL ROLLO ANTES DE COMPROBAR: CALIDAD, CANTIDAD DE METRAJE, SOLIDEZ DE COLOR, ETC.
                </p>
                <p className="font-black text-center pt-1 border-t border-app-border print:border-black">
                  DE NO CUMPLIR EL CLIENTE CON LOS 2 PUNTOS SEÑALADOS ANTERIORMENTE, ABSTENERSE DE RECLAMOS. GRACIAS POR SU COOPERACIÓN.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENT: HIGH-FIDELITY GUIA DE REMISIÓN ELECTRONICA (SUNAT)
// ============================================================================

interface GuiaRemisionPrintSheetProps {
  guiaSeries: string;
  guiaNumber: string;
  fechaHoraEmision: string;
  formattedFechaTraslado: string;
  puntoPartida: string;
  puntoLlegada: string;
  clientRuc: string;
  clientName: string;
  motivo: string;
  pesoBruto: string;
  unidadMedida: string;
  driverName: string;
  driverLicense: string;
  vehiclePlate: string;
  observaciones: string;
  despachadorName: string;
  despachadorDni: string;
  packingList: PackingList;
  getArticleName: (id: string) => string;
  groupedItems: Record<string, PackingListItem[]>;
}

function GuiaRemisionPrintSheet({
  guiaSeries,
  guiaNumber,
  fechaHoraEmision,
  formattedFechaTraslado,
  puntoPartida,
  puntoLlegada,
  clientRuc,
  clientName,
  motivo,
  pesoBruto,
  unidadMedida,
  driverName,
  driverLicense,
  vehiclePlate,
  observaciones,
  despachadorName,
  despachadorDni,
  getArticleName,
  groupedItems,
}: GuiaRemisionPrintSheetProps) {
  
  // Group packing list items by Article ID and calculate summaries
  const itemsList = React.useMemo(() => {
    return Object.keys(groupedItems).map((articleId, index) => {
      const items = groupedItems[articleId];
      const articleName = getArticleName(articleId);
      const totalArticleMeters = items.reduce((acc, item) => acc + Number(item.meters || 0), 0);
      const rollCount = items.length;
      return {
        itemNo: index + 1,
        code: articleId.substring(0, 9).toUpperCase(),
        description: articleName.toUpperCase(),
        pieces: rollCount,
        unit: 'METRO',
        quantity: totalArticleMeters.toFixed(2),
      };
    });
  }, [groupedItems, getArticleName]);

  return (
    <div translate="no" className="notranslate bg-white text-black p-8 border border-gray-300 rounded-xl shadow-lg font-sans max-w-3xl w-full my-2 min-h-[296mm] flex flex-col justify-between print-page print:border-none print:shadow-none print:p-0 print:my-0 print:bg-white box-border">
      
      <div>
        {/* Top Header: Issuer left, RUC Box right */}
        <div className="flex justify-between items-start gap-4 mb-6">
          
          {/* Issuer Details */}
          <div className="flex-1 flex gap-3.5 items-center">
            {/* Styled Circle with J Green Logo */}
            <img 
              src="/logo-juditex.png" 
              alt="Juditex" 
              className="h-16 w-auto shrink-0 object-contain print:opacity-100" 
              referrerPolicy="no-referrer"
            />
            <div className="space-y-1">
              <h1 className="text-[#1B5E20] text-base font-black tracking-tight leading-none uppercase">DEALER TEXTIL SRL</h1>
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wide leading-tight">
                CALLE IGNACIO COSSIO NRO. 1363 (UBICADO FRENTE A UN PARQUE) LIMA - LIMA - LA VICTORIA
              </p>
              <p className="text-[7.5px] font-semibold text-gray-400 uppercase leading-none mt-1">
                Moda con estilo sostenible • Almacén Central de Distribución
              </p>
            </div>
          </div>

          {/* Official SUNAT RUC Box */}
          <div className="w-60 border border-black p-3.5 text-center bg-white space-y-1 rounded shrink-0">
            <p className="text-[11px] font-black tracking-wider text-gray-800">R.U.C. 20509615595</p>
            <h2 className="text-[9.5px] font-black tracking-wider text-gray-900 uppercase py-0.5 border-y border-gray-200">
              GUÍA DE REMISIÓN REMITENTE
            </h2>
            <p className="text-xs font-black text-red-600 tracking-widest font-mono pt-1">
              N° {guiaSeries}-{guiaNumber}
            </p>
          </div>
        </div>

        {/* Section 1: Dates & Places */}
        <div className="grid grid-cols-12 gap-x-4 gap-y-2 text-[9px] border-b border-gray-200 pb-3 mb-3">
          <div className="col-span-12 md:col-span-6 space-y-1.5">
            <div className="flex">
              <span className="w-32 font-black uppercase text-gray-500 shrink-0">Fecha de Emisión:</span>
              <span className="font-mono font-bold text-gray-800">{fechaHoraEmision}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-black uppercase text-gray-500 shrink-0">Inicio de traslado:</span>
              <span className="font-mono font-bold text-gray-800">{formattedFechaTraslado}</span>
            </div>
          </div>

          <div className="col-span-12 md:col-span-6 space-y-1.5">
            <div className="flex items-start">
              <span className="w-28 font-black uppercase text-gray-500 shrink-0">RUC Destinatario:</span>
              <span className="font-mono font-bold text-gray-800 uppercase shrink-0">{clientRuc}</span>
            </div>
            <div className="flex items-start">
              <span className="w-28 font-black uppercase text-gray-500 shrink-0">Destinatario:</span>
              <span className="font-bold text-gray-900 uppercase leading-tight">{clientName}</span>
            </div>
          </div>

          <div className="col-span-12 space-y-1 pt-2 border-t border-gray-100">
            <div className="flex items-start">
              <span className="w-28 font-black uppercase text-gray-500 shrink-0">Punto de partida:</span>
              <span className="font-medium text-gray-800 uppercase leading-snug">{puntoPartida}</span>
            </div>
            <div className="flex items-start">
              <span className="w-28 font-black uppercase text-gray-500 shrink-0">Punto de llegada:</span>
              <span className="font-extrabold text-gray-950 uppercase leading-snug bg-gray-50 px-1 py-0.5 rounded border border-gray-100">{puntoLlegada}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Detalle de la guía */}
        <div className="mb-3">
          <div className="bg-gray-100 px-3 py-1 font-black text-[8.5px] uppercase tracking-wider text-gray-700 border-l-4 border-gray-500 mb-2">
            DETALLE DEL TRASLADO:
          </div>
          <div className="grid grid-cols-5 gap-2 text-[8.5px] text-gray-800 bg-gray-50 border border-gray-200 p-2 rounded">
            <div>
              <p className="font-black uppercase text-gray-400 text-[7.5px]">Modalidad</p>
              <p className="font-bold uppercase mt-0.5">PRIVADO</p>
            </div>
            <div>
              <p className="font-black uppercase text-gray-400 text-[7.5px]">Motivo Traslado</p>
              <p className="font-bold uppercase mt-0.5 text-app-primary">{motivo}</p>
            </div>
            <div>
              <p className="font-black uppercase text-gray-400 text-[7.5px]">Descripción</p>
              <p className="font-bold uppercase mt-0.5 text-gray-400">- - -</p>
            </div>
            <div>
              <p className="font-black uppercase text-gray-400 text-[7.5px]">U. M.</p>
              <p className="font-bold uppercase mt-0.5">{unidadMedida}</p>
            </div>
            <div>
              <p className="font-black uppercase text-gray-400 text-[7.5px]">Peso Bruto Total</p>
              <p className="font-mono font-black text-gray-900 mt-0.5">{Number(pesoBruto).toFixed(3)}</p>
            </div>
          </div>
        </div>

        {/* Section 3: Items table list */}
        <div className="mb-4">
          <table className="w-full text-left border-collapse border border-gray-200 text-[9px]">
            <thead>
              <tr className="bg-gray-100 text-gray-700 uppercase font-black text-[8px] tracking-wider border-b border-gray-300">
                <th className="py-1.5 px-2 border-r border-gray-200 w-10 text-center">ITEM</th>
                <th className="py-1.5 px-2 border-r border-gray-200 w-20 text-center">CÓDIGO</th>
                <th className="py-1.5 px-3 border-r border-gray-200">DESCRIPCIÓN DEL PRODUCTO (DENIM)</th>
                <th className="py-1.5 px-2 border-r border-gray-200 w-16 text-center">PIEZAS</th>
                <th className="py-1.5 px-2 border-r border-gray-200 w-16 text-center">UNIDAD</th>
                <th className="py-1.5 px-3 w-24 text-right">CANTIDAD</th>
              </tr>
            </thead>
            <tbody>
              {itemsList.map((item) => (
                <tr key={item.itemNo} className="border-b border-gray-200">
                  <td className="py-1.5 px-2 border-r border-gray-200 text-center font-mono font-bold text-gray-700">{item.itemNo}</td>
                  <td className="py-1.5 px-2 border-r border-gray-200 text-center font-mono text-gray-500">{item.code}</td>
                  <td className="py-1.5 px-3 border-r border-gray-200 font-bold text-gray-900 uppercase">{item.description}</td>
                  <td className="py-1.5 px-2 border-r border-gray-200 text-center font-mono font-bold text-gray-700">{item.pieces}</td>
                  <td className="py-1.5 px-2 border-r border-gray-200 text-center uppercase text-gray-500">{item.unit}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-black text-gray-900">{Number(item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 4: Datos del contenedor / transportista / vehiculo */}
        <div className="space-y-3.5 mb-4">
          
          <div className="grid grid-cols-2 gap-3">
            {/* Driver */}
            <div className="border border-gray-200 rounded p-2 text-[8.5px] space-y-1">
              <p className="font-black text-gray-400 uppercase text-[7.5px]">DATOS DEL CHOFER / TRANSPORTISTA:</p>
              <p className="font-bold text-gray-800">
                Chofer: <span className="font-black uppercase text-gray-950">{driverName}</span>
              </p>
              <p className="font-bold text-gray-800">
                Licencia: <span className="font-mono font-black text-gray-900">{driverLicense}</span>
              </p>
            </div>

            {/* Vehicle */}
            <div className="border border-gray-200 rounded p-2 text-[8.5px] space-y-1">
              <p className="font-black text-gray-400 uppercase text-[7.5px]">DATOS DE UNIDAD DE TRANSPORTE:</p>
              <p className="font-bold text-gray-800">
                Placa Vehicular: <span className="font-mono font-black text-gray-950 uppercase bg-yellow-50 px-1 py-0.5 rounded border border-yellow-100">{vehiclePlate}</span>
              </p>
              <p className="font-bold text-gray-800">
                Tipo Modalidad: <span className="uppercase text-gray-600 font-bold">TRANSPORTE PRIVADO</span>
              </p>
            </div>
          </div>

          {/* Observaciones */}
          <div className="border border-gray-200 rounded p-2 text-[8.5px]">
            <p className="font-black text-gray-400 uppercase text-[7.5px]">OBSERVACIONES:</p>
            <p className="font-medium text-gray-700 mt-1 uppercase leading-relaxed font-mono">
              {observaciones || '- - -'}
            </p>
          </div>

        </div>
      </div>

      {/* Signature and Footer Section */}
      <div className="border-t border-gray-200 pt-3 mt-2">
        
        {/* Signatures Row */}
        <div className="grid grid-cols-2 gap-6 text-[8.5px] text-center mb-3">
          <div className="space-y-1">
            <div className="h-8 flex items-end justify-center">
              <div className="border border-green-200 text-green-700 text-[7px] px-2 py-0.5 rounded-xs font-black tracking-widest uppercase rotate-[-1deg] bg-green-50/45 no-print">
                SISTEMA EMISOR ELECTRÓNICO SUNAT
              </div>
            </div>
            <div className="border-t border-gray-300 pt-1 max-w-xs mx-auto space-y-0.5">
              <p className="font-black uppercase text-gray-800">DESPACHO / ALMACÉN</p>
              <p className="text-gray-500 font-bold uppercase text-[7.5px]">{despachadorName}</p>
              {despachadorDni && <p className="text-gray-400 font-mono text-[7px]">DNI: {despachadorDni}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-8"></div>
            <div className="border-t border-gray-300 pt-1 max-w-xs mx-auto space-y-0.5">
              <p className="font-black uppercase text-gray-800">CONFORMIDAD DEL CLIENTE</p>
              <p className="text-gray-400 font-medium">Firma:</p>
              <p className="text-gray-300 font-mono text-[7px]">DNI: _______________________</p>
            </div>
          </div>
        </div>

        {/* QR & Footer block */}
        <div className="flex items-center gap-4 border-t border-gray-100 pt-3">
          
          {/* Beautiful SVG QR code */}
          <div className="border border-gray-200 p-1 bg-white shrink-0 rounded">
            <svg className="w-14 h-14" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100" height="100" fill="white" />
              <rect x="5" y="5" width="20" height="20" fill="black" />
              <rect x="9" y="9" width="12" height="12" fill="white" />
              <rect x="12" y="12" width="6" height="6" fill="black" />

              <rect x="75" y="5" width="20" height="20" fill="black" />
              <rect x="79" y="9" width="12" height="12" fill="white" />
              <rect x="82" y="12" width="6" height="6" fill="black" />

              <rect x="5" y="75" width="20" height="20" fill="black" />
              <rect x="9" y="79" width="12" height="12" fill="white" />
              <rect x="12" y="82" width="6" height="6" fill="black" />

              <rect x="75" y="75" width="20" height="20" fill="black" />
              <rect x="79" y="79" width="12" height="12" fill="white" />
              <rect x="82" y="82" width="6" height="6" fill="black" />

              <rect x="30" y="5" width="4" height="4" fill="black" />
              <rect x="40" y="5" width="8" height="4" fill="black" />
              <rect x="55" y="5" width="4" height="8" fill="black" />
              <rect x="65" y="10" width="6" height="6" fill="black" />
              <rect x="30" y="20" width="4" height="4" fill="black" />
              <rect x="45" y="15" width="4" height="4" fill="black" />
              <rect x="50" y="25" width="12" height="4" fill="black" />

              <rect x="30" y="30" width="8" height="8" fill="black" />
              <rect x="45" y="35" width="12" height="4" fill="black" />
              <rect x="60" y="30" width="4" height="12" fill="black" />
              <rect x="70" y="35" width="4" height="4" fill="black" />
              <rect x="35" y="45" width="4" height="12" fill="black" />
              <rect x="45" y="45" width="8" height="4" fill="black" />
              <rect x="55" y="45" width="4" height="8" fill="black" />

              <rect x="30" y="60" width="16" height="4" fill="black" />
              <rect x="50" y="55" width="4" height="12" fill="black" />
              <rect x="65" y="55" width="8" height="8" fill="black" />
              <rect x="60" y="65" width="4" height="4" fill="black" />

              <rect x="30" y="70" width="4" height="12" fill="black" />
              <rect x="40" y="75" width="12" height="4" fill="black" />
              <rect x="55" y="70" width="6" height="6" fill="black" />
              <rect x="65" y="70" width="4" height="4" fill="black" />
            </svg>
          </div>

          {/* Official disclaimer */}
          <div className="text-[7.5px] font-semibold text-gray-400 uppercase tracking-wide leading-normal">
            <p>Representación Impresa de la Guía de Remisión Remitente Electrónica. Autorizado mediante SUNAT.</p>
            <p className="font-black text-gray-500 font-mono mt-0.5">HASH: 2E9A3C2F1D8B4E7A9C5E3D2F1B0A5F2C8E7D1C3B</p>
          </div>
        </div>
      </div>
    </div>
  );
}
