import React, { useState, useEffect } from 'react';
import { 
  db, 
  seedDatabaseIfEmpty, 
  handleFirestoreError, 
  OperationType,
  getLocalMode,
  setLocalMode,
  getLocalStorageCollection,
  seedLocalStorage,
  syncLocalDataToCloud
} from './firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { Client, Seller, Provider, Article, RollItem, PackingList } from './types';

// Icons
import { 
  FileText, 
  History, 
  Layers, 
  Settings, 
  User, 
  Warehouse, 
  Activity, 
  HelpCircle,
  Truck,
  RotateCcw,
  CloudLightning,
  RefreshCw,
  Sun,
  Moon,
  Search,
  Download
} from 'lucide-react';

// Components
import PackingListForm from './components/PackingListForm';
import PackingListHistory from './components/PackingListHistory';
import InventoryManager from './components/InventoryManager';
import CatalogManager from './components/CatalogManager';
import AlertBanner from './components/AlertBanner';
import PrintPackingList from './components/PrintPackingList';
import QuickSearchPalette from './components/QuickSearchPalette';

type AppTab = 'generate' | 'history' | 'inventory' | 'catalogs';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('generate');
  const [currentOperator, setCurrentOperator] = useState('Paul Almacén');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('wms-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('wms-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Database States
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [inventory, setInventory] = useState<RollItem[]>([]);
  const [packingLists, setPackingLists] = useState<PackingList[]>([]);

  // Print Modal State
  const [selectedPrintList, setSelectedPrintList] = useState<PackingList | null>(null);

  // Edit & Duplicate States
  const [editingPackingList, setEditingPackingList] = useState<PackingList | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  // Quick Search States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [catalogInitialTab, setCatalogInitialTab] = useState<'clients' | 'articles' | 'providers' | 'sellers' | undefined>(undefined);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Handle manual sidebar tab changes (clears search query preset)
  const handleTabChange = (tab: AppTab) => {
    setCatalogInitialTab(undefined);
    setCatalogSearchQuery('');
    setHistorySearchQuery('');
    setActiveTab(tab);
  };

  // Keyboard shortcut for Ctrl+K and Escape to close modals/views
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setSelectedPrintList(null);
        setShowConnectionErrorModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectSearchResult = (type: 'client' | 'article' | 'packing_list', item: any) => {
    if (type === 'client') {
      setCatalogInitialTab('clients');
      setCatalogSearchQuery(item.name);
      setActiveTab('catalogs');
    } else if (type === 'article') {
      setCatalogInitialTab('articles');
      setCatalogSearchQuery(item.name);
      setActiveTab('catalogs');
    } else if (type === 'packing_list') {
      setHistorySearchQuery(item.packingListNo);
      setActiveTab('history');
    }
  };

  // loading state
  const [loading, setLoading] = useState(true);
  const [isLocal, setIsLocal] = useState(getLocalMode());
  const [showConnectionErrorModal, setShowConnectionErrorModal] = useState(false);
  const [connectionErrorReason, setConnectionErrorReason] = useState<string | null>(null);

  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResultModal, setSyncResultModal] = useState<{
    isOpen: boolean;
    success: boolean;
    message: string;
    counts?: {
      providers: number;
      articles: number;
      clients: number;
      sellers: number;
      inventory: number;
      packinglists: number;
    };
  } | null>(null);

  useEffect(() => {
    const collections = ['providers', 'articles', 'clients', 'sellers', 'inventory', 'packinglists'];
    const hasPending = collections.some(col => {
      const items = getLocalStorageCollection(col);
      return items.some((item: any) => item.id && String(item.id).startsWith('local-'));
    });
    setHasPendingSync(hasPending);
  }, [isLocal, clients, sellers, providers, articles, inventory, packingLists]);

  const handleSyncLocalData = async () => {
    setIsSyncing(true);
    try {
      const result = await syncLocalDataToCloud();
      if (result.success) {
        setSyncResultModal({
          isOpen: true,
          success: true,
          message: '¡Los datos creados en modo local se han sincronizado exitosamente con la nube!',
          counts: result.uploadedCounts
        });
      } else {
        setSyncResultModal({
          isOpen: true,
          success: false,
          message: result.error || 'Ocurrió un error inesperado al intentar sincronizar los datos.'
        });
      }
    } catch (err: any) {
      setSyncResultModal({
        isOpen: true,
        success: false,
        message: `Fallo inesperado: ${err?.message || err}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const loadLocalData = () => {
    seedLocalStorage();
    setClients(getLocalStorageCollection('clients'));
    setSellers(getLocalStorageCollection('sellers'));
    setProviders(getLocalStorageCollection('providers'));
    setArticles(getLocalStorageCollection('articles'));
    setInventory(getLocalStorageCollection('inventory'));
    setPackingLists(getLocalStorageCollection('packinglists'));
    setIsLocal(true);
    setLocalMode(true);
    setLoading(false);
  };

  const handleChooseLocalMode = () => {
    setShowConnectionErrorModal(false);
    loadLocalData();
  };

  const handleTryConnectCloud = () => {
    setLocalMode(false);
    setIsLocal(false);
    setLoading(true);
    window.location.reload();
  };

  // Trigger Database Seed + Firestore listeners
  useEffect(() => {
    let unsubs: (() => void)[] = [];
    let timeoutId: any = null;
    let fallbackTriggered = false;

    const triggerFallback = (reason: string) => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      console.warn(`Switched to Local Mode. Reason: ${reason}`);
      
      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Unsubscribe from any active listeners
      unsubs.forEach(unsub => {
        try { unsub(); } catch(e) {}
      });
      unsubs = [];
      
      // Always load local data so application content is populated immediately
      loadLocalData();
      setConnectionErrorReason(reason);

      // Show connection modal if user wasn't explicitly in local mode
      if (!getLocalMode()) {
        setShowConnectionErrorModal(true);
      }
    };

    async function initDb() {
      // Always pre-seed local storage so fallback is instant if needed
      seedLocalStorage();

      // Check user's preferred or current local mode
      if (getLocalMode()) {
        triggerFallback("User previously active in Local Mode");
        return;
      }

      // Safety timeout: if Firestore takes too long to load (e.g., initial DB setup latency),
      // fallback to local storage so user doesn't get stuck on loading screen
      timeoutId = setTimeout(() => {
        triggerFallback("Firestore connection timeout (8 seconds)");
      }, 8000);

      try {
        // Seed first to prevent empty dashboard
        await seedDatabaseIfEmpty();
        
        // Start Realtime Firestore Observers
        const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
          const list: Client[] = [];
          snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Client));
          setClients(list);
        }, (error) => {
          console.error("Firestore Clients error:", error);
          triggerFallback("Clients Permission Denied / Error");
        });
        unsubs.push(unsubClients);

        const unsubSellers = onSnapshot(collection(db, 'sellers'), (snapshot) => {
          const list: Seller[] = [];
          snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Seller));
          setSellers(list);
        }, (error) => {
          console.error("Firestore Sellers error:", error);
          triggerFallback("Sellers Permission Denied / Error");
        });
        unsubs.push(unsubSellers);

        const unsubProviders = onSnapshot(collection(db, 'providers'), (snapshot) => {
          const list: Provider[] = [];
          snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Provider));
          setProviders(list);
        }, (error) => {
          console.error("Firestore Providers error:", error);
          triggerFallback("Providers Permission Denied / Error");
        });
        unsubs.push(unsubProviders);

        const unsubArticles = onSnapshot(collection(db, 'articles'), (snapshot) => {
          const list: Article[] = [];
          snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id } as Article));
          setArticles(list);
        }, (error) => {
          console.error("Firestore Articles error:", error);
          triggerFallback("Articles Permission Denied / Error");
        });
        unsubs.push(unsubArticles);

        const unsubInventory = onSnapshot(collection(db, 'inventory'), (snapshot) => {
          const list: RollItem[] = [];
          snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id } as RollItem));
          setInventory(list);
        }, (error) => {
          console.error("Firestore Inventory error:", error);
          triggerFallback("Inventory Permission Denied / Error");
        });
        unsubs.push(unsubInventory);

        const unsubPackingLists = onSnapshot(collection(db, 'packinglists'), (snapshot) => {
          const list: PackingList[] = [];
          snapshot.forEach(doc => list.push({ ...doc.data(), id: doc.id } as PackingList));
          setPackingLists(list);
        }, (error) => {
          console.error("Firestore Packinglists error:", error);
          triggerFallback("Packinglists Permission Denied / Error");
        });
        unsubs.push(unsubPackingLists);

        // If we reach here successfully and didn't trigger fallback yet
        if (!fallbackTriggered) {
          clearTimeout(timeoutId);
          setIsLocal(false);
          setLocalMode(false);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error initializing Firestore DB:", error);
        triggerFallback("Firestore Seed/Init failed");
      }
    }

    initDb();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubs.forEach(unsub => {
        try { unsub(); } catch(e) {}
      });
    };
  }, []);

  // Refresh helper (mostly handled by onSnapshot, but triggers full check)
  const handleForceRefresh = async () => {
    setLoading(true);
    if (getLocalMode() || isLocal) {
      loadLocalData();
    } else {
      try {
        await seedDatabaseIfEmpty();
        setConnectionErrorReason(null);
      } catch (e: any) {
        console.error(e);
        const reasonStr = `Error al refrescar conexión: ${e?.message || e}`;
        setConnectionErrorReason(reasonStr);
        loadLocalData();
        setShowConnectionErrorModal(true);
      } finally {
        setLoading(false);
      }
    }
  };

  const getActiveTabComponent = () => {
    switch (activeTab) {
      case 'generate':
        return (
          <PackingListForm
            clients={clients}
            sellers={sellers}
            providers={providers}
            articles={articles}
            inventory={inventory}
            packingLists={packingLists}
            onRefresh={handleForceRefresh}
            onPackingListCreated={(pl) => {
              setSelectedPrintList(pl);
              setEditingPackingList(null);
              setIsDuplicate(false);
            }}
            currentOperator={currentOperator}
            editingPackingList={editingPackingList}
            isDuplicate={isDuplicate}
            onCancelEdit={(goToHistory = true) => {
              setEditingPackingList(null);
              setIsDuplicate(false);
              if (goToHistory) {
                setActiveTab('history');
              }
            }}
          />
        );
      case 'history':
        return (
          <PackingListHistory
            packingLists={packingLists}
            clients={clients}
            sellers={sellers}
            providers={providers}
            articles={articles}
            inventory={inventory}
            onRefresh={handleForceRefresh}
            onSelectPrint={(pl) => setSelectedPrintList(pl)}
            onEdit={(pl) => {
              setEditingPackingList(pl);
              setIsDuplicate(false);
              setActiveTab('generate');
            }}
            initialSearchTerm={historySearchQuery}
            onCreateNew={() => setActiveTab('generate')}
          />
        );
      case 'inventory':
        return (
          <InventoryManager
            inventory={inventory}
            providers={providers}
            articles={articles}
            onRefresh={handleForceRefresh}
            currentOperator={currentOperator}
          />
        );
      case 'catalogs':
        return (
          <CatalogManager
            clients={clients}
            sellers={sellers}
            providers={providers}
            articles={articles}
            packingLists={packingLists}
            onRefresh={handleForceRefresh}
            initialTab={catalogInitialTab}
            initialSearchQuery={catalogSearchQuery}
          />
        );
      default:
        return null;
    }
  };

  const getFormattedDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}${minutes}`;
  };

  const handleDownloadBackup = () => {
    const backupData = {
      backupDate: new Date().toISOString(),
      providers,
      articles,
      clients,
      sellers,
      inventory,
      packingLists
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_texflow_${getFormattedDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div translate="no" className={`min-h-screen bg-app-bg text-app-text flex flex-col md:flex-row font-sans select-none antialiased notranslate ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Sidebar Navigation - Sleek Brand Responsive Theme (no-print) */}
      <aside className="w-full md:w-64 bg-[#F5F3EE] dark:bg-[#14201F] text-app-text flex flex-col shrink-0 border-b md:border-b-0 md:border-r border-app-border/60 no-print">
        {/* Brand / Logo Header */}
        <div className="p-6 border-b border-app-border/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-app-surface border border-app-border p-2 rounded-md text-app-text shadow-xs">
              <Warehouse size={18} className="stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-wider text-app-text uppercase leading-none">Control Almacén</h1>
              <span className="text-[9px] text-app-text/60 font-mono uppercase tracking-widest mt-1 block">WMS Enterprise</span>
            </div>
          </div>
        </div>

        {/* Status Indicators Integrated in Sidebar */}
        <div className="px-6 py-4 border-b border-app-border/25 bg-app-surface/20 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-app-text/75">
            <span>Servidor de Datos:</span>
            {isLocal ? (
              <span className="inline-flex items-center gap-1.5 text-app-primary font-semibold text-[10px] bg-app-primary/10 px-2 py-0.5 rounded border border-app-primary/20">
                <span className="h-1.5 w-1.5 rounded-full bg-app-primary animate-pulse"></span>
                Demo Local
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-app-secondary font-semibold text-[10px] bg-app-secondary/10 px-2 py-0.5 rounded border border-app-secondary/20">
                <span className="h-1.5 w-1.5 rounded-full bg-app-secondary"></span>
                Sincronizado
              </span>
            )}
          </div>
          <div className="text-[10px] text-app-text/50 font-mono flex items-center justify-between">
            <span>Terminal: wms-client</span>
            <span>v2.6r</span>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 p-4 space-y-1">
          <div className="text-[9px] font-bold text-app-text/50 uppercase tracking-widest px-3 mb-3">
            Módulos del Sistema
          </div>

          <button
            onClick={() => handleTabChange('generate')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition duration-150 cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-app-primary text-white border-l-2 border-app-primary font-semibold shadow-xs'
                : 'text-app-text/60 hover:text-app-text hover:bg-app-primary/10'
            }`}
            id="tab-generate"
          >
            <FileText size={14} className={activeTab === 'generate' ? 'text-white' : 'text-app-text/50'} />
            Generar Packing List
          </button>

          <button
            onClick={() => handleTabChange('history')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition duration-150 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-app-primary text-white border-l-2 border-app-primary font-semibold shadow-xs'
                : 'text-app-text/60 hover:text-app-text hover:bg-app-primary/10'
            }`}
            id="tab-history"
          >
            <History size={14} className={activeTab === 'history' ? 'text-white' : 'text-app-text/50'} />
            Historial de Packing Lists
          </button>

          <button
            onClick={() => handleTabChange('inventory')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition duration-150 cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-app-primary text-white border-l-2 border-app-primary font-semibold shadow-xs'
                : 'text-app-text/60 hover:text-app-text hover:bg-app-primary/10'
            }`}
            id="tab-inventory"
          >
            <Warehouse size={14} className={activeTab === 'inventory' ? 'text-white' : 'text-app-text/50'} />
            Inventario de Rollos
          </button>

          <button
            onClick={() => handleTabChange('catalogs')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition duration-150 cursor-pointer ${
              activeTab === 'catalogs'
                ? 'bg-app-primary text-white border-l-2 border-app-primary font-semibold shadow-xs'
                : 'text-app-text/60 hover:text-app-text hover:bg-app-primary/10'
            }`}
            id="tab-catalogs"
          >
            <Settings size={14} className={activeTab === 'catalogs' ? 'text-white' : 'text-app-text/50'} />
            Configuración y Catálogos
          </button>
        </nav>

        {/* Quick Connection Action for Local DemoFallback */}
        {isLocal && (
          <div className="p-4 m-4 bg-app-primary/5 border border-app-primary/20 rounded-md text-xs text-app-text/80 flex flex-col gap-2">
            <p className="leading-tight text-[10px] text-app-primary">
              <strong>Modo Local Activo:</strong> Los datos se almacenan de manera local en el navegador.
            </p>
            <button 
              onClick={handleTryConnectCloud}
              className="w-full py-1.5 bg-app-primary hover:bg-app-primary/90 text-white font-semibold rounded text-[10px] transition uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
            >
              <RefreshCw size={10} className="animate-spin-slow" />
              Sincronizar Nube
            </button>
          </div>
        )}

        {/* Operator Selector Section - Embedded in Sidebar Footer */}
        <div className="p-4 border-t border-app-border/45 bg-app-surface/20">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded bg-app-surface border border-app-border flex items-center justify-center text-app-text/70">
              <User size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-[8px] uppercase font-bold tracking-widest text-app-text/50">Operario Actual</span>
              <select
                value={currentOperator}
                onChange={e => setCurrentOperator(e.target.value)}
                className="bg-transparent text-[11px] font-medium text-app-text focus:outline-hidden cursor-pointer w-full text-left truncate -ml-0.5 mt-0.5 border-none p-0 focus:ring-0"
                id="select-operator-user"
              >
                <option value="Paul Almacén" className="bg-app-surface text-app-text">Paul (Almacén Central)</option>
                <option value="Administrador" className="bg-app-surface text-app-text">Administrador de Red</option>
                <option value="Operador Turno Mañana" className="bg-app-surface text-app-text">Operador Turno Mañana</option>
                <option value="Despachador Principal" className="bg-app-surface text-app-text">Despachador Principal</option>
              </select>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container - Structured Workspace */}
      <div className={`flex-1 min-w-0 bg-app-bg flex flex-col ${theme === 'dark' ? 'dark' : ''} ${selectedPrintList ? 'no-print' : ''}`}>
        
        {/* Top Header Bar (no-print) */}
        <header className="bg-app-surface border-b border-app-border px-6 py-4 flex flex-wrap justify-between items-center gap-4 no-print shrink-0">
          <div>
            <div className="text-[9px] font-bold text-app-text/50 uppercase tracking-widest">
              SISTEMA DE CONTROL Y DESPACHOS
            </div>
            <h2 className="text-base font-bold text-app-text tracking-tight mt-0.5">
              {activeTab === 'generate' && "Generación de Packing List"}
              {activeTab === 'history' && "Historial de Packing Lists"}
              {activeTab === 'inventory' && "Inventario de Rollos"}
              {activeTab === 'catalogs' && "Configuración y Catálogos"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Search Trigger Button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-1.5 hover:bg-app-bg text-app-text/70 hover:text-app-text border border-app-border rounded transition flex items-center justify-center cursor-pointer gap-1.5 px-2.5"
              title="Buscar (Ctrl+K)"
              id="global-search-trigger-btn"
            >
              <Search size={13} />
              <span className="text-[10px] font-bold text-app-text/50 hidden md:inline font-mono">Ctrl+K</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-1.5 hover:bg-app-bg text-app-text/70 hover:text-app-text border border-app-border rounded transition flex items-center justify-center cursor-pointer"
              title={theme === 'light' ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
              id="theme-toggle-btn"
            >
              {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
            </button>

            <button
              onClick={handleForceRefresh}
              className="p-1.5 hover:bg-app-bg text-app-text/70 hover:text-app-text border border-app-border rounded transition cursor-pointer"
              title="Sincronizar base de datos"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-app-secondary" : ""} />
            </button>
            
            <div className="text-right hidden sm:block font-mono text-[10px] text-app-text/50 border-l border-app-border pl-3">
              {new Date().toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Content Body Wrapper */}
        <main className="flex-1 p-6 overflow-y-auto space-y-4">
          {connectionErrorReason && (
            <AlertBanner
              type="warning"
              title="Aviso de carga: Modo Local Activado"
              message={`No se pudo conectar a la nube de Firestore. El sistema activó el modo local. Motivo: ${connectionErrorReason}`}
              onDismiss={() => setConnectionErrorReason(null)}
            />
          )}

          {loading ? (
            <div className="flex flex-col justify-center items-center h-80 gap-3 bg-app-surface border border-app-border rounded-lg p-8 shadow-xs">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-app-secondary"></div>
              <p className="text-xs font-semibold text-app-text">Sincronizando base de datos en tiempo real...</p>
              <p className="text-[10px] text-app-text/50 font-mono">Cargando módulos de WMS Enterprise</p>
            </div>
          ) : (
            getActiveTabComponent()
          )}
        </main>

        {/* High Density Status Bar - Bottom (no-print) */}
        <footer className="bg-app-surface text-app-text/50 px-6 py-2.5 text-[9px] flex flex-wrap justify-between items-center border-t border-app-border no-print font-mono">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="h-1.5 w-1.5 rounded-full bg-app-secondary animate-pulse"></span>
            WMS Mode: {isLocal ? "Local Demo Offline" : "Firestore Production DB"} • LiveSync • TLS Secure
            <button
              onClick={handleDownloadBackup}
              className="ml-3 px-2 py-0.5 bg-app-primary hover:bg-app-primary/95 text-white font-semibold rounded text-[8px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition duration-150 shadow-xs border border-app-primary"
              title="Descargar un respaldo completo de la base de datos en formato JSON"
            >
              <Download size={8} />
              Descargar Respaldo Completo
            </button>
            {isLocal && hasPendingSync && (
              <button
                onClick={handleSyncLocalData}
                disabled={isSyncing}
                className="ml-3 px-2 py-0.5 bg-app-primary hover:bg-app-primary/95 text-white font-semibold rounded text-[8px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition duration-150 disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw size={8} className="animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <CloudLightning size={8} />
                    Subir Datos Locales a la Nube
                  </>
                )}
              </button>
            )}
          </span>
          <span className="uppercase tracking-wider">
            © 2026 Sistema WMS • Almacén y Logística
          </span>
        </footer>
      </div>

      {/* Printable Dual Copy Popup Modal Overlay */}
      {selectedPrintList && (
        <PrintPackingList
          packingList={selectedPrintList}
          clients={clients}
          sellers={sellers}
          providers={providers}
          articles={articles}
          onClose={() => setSelectedPrintList(null)}
        />
      )}

      {/* Quick Search Global Command Palette */}
      <QuickSearchPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        clients={clients}
        articles={articles}
        packingLists={packingLists}
        onSelectResult={handleSelectSearchResult}
      />

      {/* Cloud Connection Error / Timeout Modal Overlay */}
      {showConnectionErrorModal && (
        <div translate="no" className="fixed inset-0 bg-app-bg/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print notranslate">
          <div className="bg-app-surface border border-app-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up text-app-text">
            <div className="bg-app-primary/10 border-b border-app-border p-5 flex items-start gap-3.5">
              <div className="bg-app-primary/20 text-app-primary p-2.5 rounded-lg shrink-0 border border-app-primary/20">
                <CloudLightning size={20} className="stroke-[2] animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-app-text uppercase tracking-wider">CONEXIÓN NO DISPONIBLE</h4>
                <p className="text-[10px] font-bold text-app-primary uppercase tracking-widest mt-0.5">SISTEMA CONTROL ALMACÉN</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {connectionErrorReason && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold block uppercase text-[10px] tracking-wider mb-1">Motivo detectado:</span>
                  <p className="font-mono text-[11px] font-semibold">{connectionErrorReason}</p>
                </div>
              )}

              <p className="text-xs font-semibold leading-relaxed text-app-text">
                No se pudo establecer conexión con la base de datos en la nube. Se han cargado automáticamente tus datos locales para que no quedes bloqueado y puedas seguir usando el sistema.
              </p>
              <div className="bg-app-bg border border-app-border rounded-lg p-3 text-[10px] text-app-text/70 leading-normal font-mono">
                <span className="block font-bold text-app-text uppercase mb-1 tracking-wider text-[9px]">Aviso de sincronización:</span>
                Al trabajar en modo local, los datos de catálogos y despachos se almacenarán únicamente en el almacenamiento del navegador (localStorage) y no se sincronizarán con los demás dispositivos.
              </div>
            </div>
            
            <div className="bg-app-bg/60 px-6 py-4 border-t border-app-border flex flex-col gap-2.5 sm:flex-row justify-end">
              <button
                onClick={handleTryConnectCloud}
                className="px-4 py-2 bg-app-primary hover:bg-app-primary/90 text-white rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm border border-app-primary uppercase tracking-wider"
              >
                <RefreshCw size={11} className="animate-spin-slow" />
                Reintentar
              </button>
              <button
                onClick={handleChooseLocalMode}
                className="px-4 py-2 bg-app-secondary hover:bg-app-secondary/90 text-white rounded-lg text-xs font-extrabold transition flex items-center justify-center cursor-pointer shadow-sm uppercase tracking-wider text-center"
              >
                Trabajar en modo local (los datos no se sincronizarán)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Synchronization Status Modal */}
      {syncResultModal && syncResultModal.isOpen && (
        <div translate="no" className="fixed inset-0 bg-app-bg/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print notranslate">
          <div className="bg-app-surface border border-app-border rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up text-app-text">
            <div className={`border-b border-app-border p-5 flex items-start gap-3.5 ${syncResultModal.success ? 'bg-app-secondary/10' : 'bg-red-500/10'}`}>
              <div className={`p-2.5 rounded-lg shrink-0 border ${syncResultModal.success ? 'bg-app-secondary/20 text-app-secondary border-app-secondary/20' : 'bg-red-500/20 text-red-500 border-red-500/20'}`}>
                {syncResultModal.success ? (
                  <RefreshCw size={20} className="stroke-[2]" />
                ) : (
                  <CloudLightning size={20} className="stroke-[2] animate-bounce" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-app-text uppercase tracking-wider">
                  {syncResultModal.success ? 'Sincronización Exitosa' : 'Error de Sincronización'}
                </h4>
                <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${syncResultModal.success ? 'text-app-secondary' : 'text-red-500'}`}>
                  {syncResultModal.success ? 'DATOS SUBIDOS A FIRESTORE' : 'PROCESO DETENIDO'}
                </p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <AlertBanner
                type={syncResultModal.success ? "success" : "error"}
                message={syncResultModal.message}
              />
              
              {syncResultModal.success && syncResultModal.counts && (
                <div className="bg-app-bg border border-app-border rounded-lg p-4 text-[11px] leading-relaxed font-mono space-y-1.5">
                  <span className="block font-bold text-app-text uppercase mb-2 tracking-wider text-[9px]">Registros Sincronizados:</span>
                  <div className="flex justify-between border-b border-app-border/40 pb-1">
                    <span>Proveedores:</span>
                    <span className="font-bold text-app-secondary">{syncResultModal.counts.providers}</span>
                  </div>
                  <div className="flex justify-between border-b border-app-border/40 pb-1">
                    <span>Artículos:</span>
                    <span className="font-bold text-app-secondary">{syncResultModal.counts.articles}</span>
                  </div>
                  <div className="flex justify-between border-b border-app-border/40 pb-1">
                    <span>Clientes:</span>
                    <span className="font-bold text-app-secondary">{syncResultModal.counts.clients}</span>
                  </div>
                  <div className="flex justify-between border-b border-app-border/40 pb-1">
                    <span>Vendedores:</span>
                    <span className="font-bold text-app-secondary">{syncResultModal.counts.sellers}</span>
                  </div>
                  <div className="flex justify-between border-b border-app-border/40 pb-1">
                    <span>Inventario de Rollos:</span>
                    <span className="font-bold text-app-secondary">{syncResultModal.counts.inventory}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Packing Lists:</span>
                    <span className="font-bold text-app-secondary">{syncResultModal.counts.packinglists}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-app-bg/60 px-6 py-4 border-t border-app-border flex justify-end">
              <button
                onClick={() => {
                  const succeeded = syncResultModal.success;
                  setSyncResultModal(null);
                  if (succeeded) {
                    setLocalMode(false);
                    setIsLocal(false);
                    setLoading(true);
                    window.location.reload();
                  }
                }}
                className={`px-5 py-2.5 rounded-lg text-xs font-extrabold transition cursor-pointer shadow-sm uppercase tracking-wider ${
                  syncResultModal.success 
                    ? 'bg-app-secondary hover:bg-app-secondary/90 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {syncResultModal.success ? 'Aceptar y Reconectar' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
