import React, { useState, useEffect } from 'react';
import { Client, Seller, Provider, Article, PackingList } from '../types';
import { db, addDoc, updateDoc, deleteDoc } from '../firebase';
import { collection, doc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, Users, Briefcase, Truck, Layers, Check, X, Search } from 'lucide-react';

interface CatalogManagerProps {
  clients: Client[];
  sellers: Seller[];
  providers: Provider[];
  articles: Article[];
  packingLists: PackingList[];
  onRefresh: () => Promise<void>;
  initialTab?: CatalogTab;
  initialSearchQuery?: string;
}

type CatalogTab = 'providers' | 'articles' | 'clients' | 'sellers';

export default function CatalogManager({
  clients,
  sellers,
  providers,
  articles,
  packingLists,
  onRefresh,
  initialTab,
  initialSearchQuery
}: CatalogManagerProps) {
  const [activeTab, setActiveTab] = useState<CatalogTab>('providers');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Handle external navigation/filtering from global search
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  // Form States
  // Provider Form
  const [provName, setProvName] = useState('');
  const [provHasLot, setProvHasLot] = useState(true);
  const [provHasPartida, setProvHasPartida] = useState(true);
  const [provHasTono, setProvHasTono] = useState(true);
  const [provHasRollNo, setProvHasRollNo] = useState(true);
  const [provHasWidth, setProvHasWidth] = useState(false);
  const [provHasWeight, setProvHasWeight] = useState(false);

  // Article Form
  const [artName, setArtName] = useState('');
  const [artDesc, setArtDesc] = useState('');
  const [artUnit, setArtUnit] = useState('metros');
  const [artProvId, setArtProvId] = useState('');

  // Client Form
  const [cliName, setCliName] = useState('');
  const [cliDni, setCliDni] = useState('');
  const [cliEmail, setCliEmail] = useState('');
  const [cliPhone, setCliPhone] = useState('');
  const [cliAddress, setCliAddress] = useState('');

  // Seller Form
  const [selName, setSelName] = useState('');
  const [selEmail, setSelEmail] = useState('');
  const [selPhone, setSelPhone] = useState('');

  // Reset form inputs
  const resetForms = () => {
    setEditingId(null);
    setError(null);
    setSearchQuery('');
    
    // Providers
    setProvName('');
    setProvHasLot(true);
    setProvHasPartida(true);
    setProvHasTono(true);
    setProvHasRollNo(true);
    setProvHasWidth(false);
    setProvHasWeight(false);

    // Articles
    setArtName('');
    setArtDesc('');
    setArtUnit('metros');
    setArtProvId(providers[0]?.id || '');

    // Clients
    setCliName('');
    setCliDni('');
    setCliEmail('');
    setCliPhone('');
    setCliAddress('');

    // Sellers
    setSelName('');
    setSelEmail('');
    setSelPhone('');
  };

  const handleEditInit = (tab: CatalogTab, item: any) => {
    setEditingId(item.id);
    if (tab === 'providers') {
      setProvName(item.name);
      setProvHasLot(item.hasLot);
      setProvHasPartida(item.hasPartida);
      setProvHasTono(item.hasTono);
      setProvHasRollNo(item.hasRollNo ?? true);
      setProvHasWidth(item.hasWidth ?? false);
      setProvHasWeight(item.hasWeight ?? false);
    } else if (tab === 'articles') {
      setArtName(item.name);
      setArtDesc(item.description);
      setArtUnit(item.unit);
      setArtProvId(item.providerId);
    } else if (tab === 'clients') {
      setCliName(item.name);
      setCliDni(item.dni);
      setCliEmail(item.email);
      setCliPhone(item.phone);
      setCliAddress(item.address);
    } else if (tab === 'sellers') {
      setSelName(item.name);
      setSelEmail(item.email);
      setSelPhone(item.phone);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'providers') {
        if (!provName.trim()) throw new Error('El nombre del proveedor es obligatorio');
        const providerData = {
          name: provName,
          hasLot: provHasLot,
          hasPartida: provHasPartida,
          hasTono: provHasTono,
          hasRollNo: provHasRollNo,
          hasWidth: provHasWidth,
          hasWeight: provHasWeight
        };

        if (editingId) {
          await updateDoc(doc(db, 'providers', editingId), providerData);
        } else {
          await addDoc(collection(db, 'providers'), {
            ...providerData,
            createdAt: new Date().toISOString()
          });
        }
      } 
      
      else if (activeTab === 'articles') {
        if (!artName.trim()) throw new Error('El nombre del artículo es obligatorio');
        if (!artProvId) throw new Error('Debe asociar un proveedor');
        const articleData = {
          name: artName,
          description: artDesc,
          unit: artUnit,
          providerId: artProvId
        };

        if (editingId) {
          await updateDoc(doc(db, 'articles', editingId), articleData);
        } else {
          await addDoc(collection(db, 'articles'), {
            ...articleData,
            createdAt: new Date().toISOString()
          });
        }
      } 
      
      else if (activeTab === 'clients') {
        if (!cliName.trim()) throw new Error('El nombre del cliente es obligatorio');
        if (!cliDni.trim()) throw new Error('El DNI/RUC es obligatorio');
        const clientData = {
          name: cliName,
          dni: cliDni,
          email: cliEmail,
          phone: cliPhone,
          address: cliAddress
        };

        if (editingId) {
          await updateDoc(doc(db, 'clients', editingId), clientData);
        } else {
          await addDoc(collection(db, 'clients'), {
            ...clientData,
            createdAt: new Date().toISOString()
          });
        }
      } 
      
      else if (activeTab === 'sellers') {
        if (!selName.trim()) throw new Error('El nombre del vendedor es obligatorio');
        const sellerData = {
          name: selName,
          email: selEmail,
          phone: selPhone
        };

        if (editingId) {
          await updateDoc(doc(db, 'sellers', editingId), sellerData);
        } else {
          await addDoc(collection(db, 'sellers'), {
            ...sellerData,
            createdAt: new Date().toISOString()
          });
        }
      }

      await onRefresh();
      resetForms();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al guardar el registro');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tab: CatalogTab, id: string) => {
    let count = 0;
    if (tab === 'clients') {
      count = packingLists.filter(pl => pl.clientId === id).length;
    } else if (tab === 'sellers') {
      count = packingLists.filter(pl => pl.sellerId === id).length;
    } else if (tab === 'providers') {
      count = packingLists.filter(pl => pl.items?.some(item => item.providerId === id)).length;
    } else if (tab === 'articles') {
      count = packingLists.filter(pl => pl.items?.some(item => item.articleId === id)).length;
    }

    const confirmMessage = count > 0
      ? `Este registro tiene ${count} Packing List(s) asociados. Eliminarlo NO borrará esos despachos, pero perderás la referencia a este nombre/dato en ellos (aparecerá como "no disponible" en el historial). ¿Deseas continuar de todas formas?`
      : '¿Está seguro de eliminar este registro del catálogo?';

    if (!window.confirm(confirmMessage)) return;
    setLoading(true);
    setError(null);
    try {
      await deleteDoc(doc(db, tab, id));
      await onRefresh();
      resetForms();
    } catch (err: any) {
      console.error(err);
      setError('No se pudo eliminar el registro, puede que esté en uso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-1">
      {/* Sidebar navigation */}
      <div className="lg:col-span-1 ticket-perforated p-4 shadow-xs space-y-1">
        <h3 className="font-bold text-app-text/80 text-xs mb-3 px-2 uppercase tracking-wider">Gestión de Catálogos</h3>
        
        <button
          onClick={() => { setActiveTab('providers'); resetForms(); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'providers'
              ? 'bg-app-bg text-app-text border-l-2 border-app-primary'
              : 'text-app-text/70 hover:bg-app-bg/50'
          }`}
          id="tab-cat-providers"
        >
          <Truck size={15} />
          Proveedores Dinámicos
        </button>

        <button
          onClick={() => { setActiveTab('articles'); resetForms(); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'articles'
              ? 'bg-app-bg text-app-text border-l-2 border-app-primary'
              : 'text-app-text/70 hover:bg-app-bg/50'
          }`}
          id="tab-cat-articles"
        >
          <Layers size={15} />
          Artículos (Telas)
        </button>

        <button
          onClick={() => { setActiveTab('clients'); resetForms(); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'clients'
              ? 'bg-app-bg text-app-text border-l-2 border-app-primary'
              : 'text-app-text/70 hover:bg-app-bg/50'
          }`}
          id="tab-cat-clients"
        >
          <Users size={15} />
          Clientes de la Empresa
        </button>

        <button
          onClick={() => { setActiveTab('sellers'); resetForms(); }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            activeTab === 'sellers'
              ? 'bg-app-bg text-app-text border-l-2 border-app-primary'
              : 'text-app-text/70 hover:bg-app-bg/50'
          }`}
          id="tab-cat-sellers"
        >
          <Briefcase size={15} />
          Vendedores
        </button>
      </div>

      {/* Form and List Column */}
      <div className="lg:col-span-3 space-y-6">
        {/* Error box */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Dynamic Form Card */}
        <div className="ticket-perforated p-5 shadow-xs">
          <h2 className="text-xs font-bold text-app-text uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-app-border pb-3">
            <Plus size={14} className="text-app-text/50" />
            {editingId ? 'Editar Registro' : 'Agregar Nuevo Registro'}: {
              activeTab === 'providers' ? 'Proveedor' :
              activeTab === 'articles' ? 'Artículo de Tela' :
              activeTab === 'clients' ? 'Cliente' : 'Vendedor'
            }
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            {/* providers inputs */}
            {activeTab === 'providers' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Nombre Comercial del Proveedor *</label>
                  <input
                    type="text"
                    required
                    value={provName}
                    onChange={e => setProvName(e.target.value)}
                    placeholder="Ej. Textiles del Sur S.A.C."
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                    id="input-prov-name"
                  />
                </div>
                
                <div>
                  <span className="block text-xs font-bold text-app-text/80 mb-2 uppercase tracking-wider">Configuración Dinámica de Parámetros de Stock:</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-3 bg-app-bg/40 border border-app-border rounded">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-app-text/90">
                      <input
                        type="checkbox"
                        checked={provHasLot}
                        onChange={e => setProvHasLot(e.target.checked)}
                        className="rounded text-app-primary focus:ring-app-primary h-4 w-4"
                      />
                      Maneja Lote
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-app-text/90">
                      <input
                        type="checkbox"
                        checked={provHasPartida}
                        onChange={e => setProvHasPartida(e.target.checked)}
                        className="rounded text-app-primary focus:ring-app-primary h-4 w-4"
                      />
                      Maneja Partida
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-app-text/90">
                      <input
                        type="checkbox"
                        checked={provHasTono}
                        onChange={e => setProvHasTono(e.target.checked)}
                        className="rounded text-app-primary focus:ring-app-primary h-4 w-4"
                      />
                      Maneja Tono
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-app-text/90">
                      <input
                        type="checkbox"
                        checked={provHasRollNo}
                        onChange={e => setProvHasRollNo(e.target.checked)}
                        className="rounded text-app-primary focus:ring-app-primary h-4 w-4"
                      />
                      Maneja Nº Rollo
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-app-text/90">
                      <input
                        type="checkbox"
                        checked={provHasWidth}
                        onChange={e => setProvHasWidth(e.target.checked)}
                        className="rounded text-app-primary focus:ring-app-primary h-4 w-4"
                      />
                      Maneja Ancho
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-app-text/90">
                      <input
                        type="checkbox"
                        checked={provHasWeight}
                        onChange={e => setProvHasWeight(e.target.checked)}
                        className="rounded text-app-primary focus:ring-app-primary h-4 w-4"
                      />
                      Maneja Peso
                    </label>
                  </div>
                  <p className="text-[10px] text-app-text/50 mt-1.5">
                    * Al marcar o desmarcar, los packing lists y formularios de inventario habilitarán dinámicamente estos campos según el proveedor elegido.
                  </p>
                </div>
              </div>
            )}

            {/* articles inputs */}
            {activeTab === 'articles' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Nombre del Artículo (Tela) *</label>
                  <input
                    type="text"
                    required
                    value={artName}
                    onChange={e => setArtName(e.target.value)}
                    placeholder="Ej. Algodón Jersey 30/1"
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                    id="input-art-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Proveedor Asociado *</label>
                  <select
                    required
                    value={artProvId}
                    onChange={e => setArtProvId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                    id="input-art-prov"
                  >
                    <option value="">-- Seleccionar Proveedor --</option>
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Descripción / Notas</label>
                  <input
                    type="text"
                    value={artDesc}
                    onChange={e => setArtDesc(e.target.value)}
                    placeholder="Ej. Gramaje 180g, ancho 1.60m"
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Unidad de Medida</label>
                  <input
                    type="text"
                    required
                    value={artUnit}
                    onChange={e => setArtUnit(e.target.value)}
                    className="w-full px-3 py-1.5 bg-app-bg border border-app-border rounded text-app-text/75 text-xs font-medium"
                    readOnly
                  />
                </div>
              </div>
            )}

            {/* clients inputs */}
            {activeTab === 'clients' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Nombre Completo / Razón Social *</label>
                  <input
                    type="text"
                    required
                    value={cliName}
                    onChange={e => setCliName(e.target.value)}
                    placeholder="Ej. Confecciones Gamarra S.A.C."
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                    id="input-cli-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">DNI / RUC *</label>
                  <input
                    type="text"
                    required
                    value={cliDni}
                    onChange={e => setCliDni(e.target.value)}
                    placeholder="DNI de 8 dígitos o RUC de 11 dígitos"
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                    id="input-cli-dni"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Correo Electrónico</label>
                  <input
                    type="email"
                    value={cliEmail}
                    onChange={e => setCliEmail(e.target.value)}
                    placeholder="correo@cliente.com"
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Teléfono</label>
                  <input
                    type="text"
                    value={cliPhone}
                    onChange={e => setCliPhone(e.target.value)}
                    placeholder="Celular de contacto"
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Dirección de Entrega / Despacho</label>
                  <input
                    type="text"
                    value={cliAddress}
                    onChange={e => setCliAddress(e.target.value)}
                    placeholder="Av, Calle, Jr, Número, Distrito, Provincia"
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                  />
                </div>
              </div>
            )}

            {/* sellers inputs */}
            {activeTab === 'sellers' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Nombre del Vendedor *</label>
                  <input
                    type="text"
                    required
                    value={selName}
                    onChange={e => setSelName(e.target.value)}
                    placeholder="Ej. Roberto Benavides"
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                    id="input-sel-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Correo de Contacto</label>
                  <input
                    type="email"
                    value={selEmail}
                    onChange={e => setSelEmail(e.target.value)}
                    placeholder="vendedor@empresa.com"
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-app-text/80 mb-1 uppercase tracking-wider">Teléfono Móvil</label>
                  <input
                    type="text"
                    value={selPhone}
                    onChange={e => setSelPhone(e.target.value)}
                    placeholder="900000000"
                    className="w-full px-3 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary"
                  />
                </div>
              </div>
            )}

            {/* Form actions */}
            <div className="flex justify-end gap-2 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForms}
                  className="px-4 py-1.5 border border-app-border hover:bg-app-bg text-app-text rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cancelar Edición
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-1.5 bg-app-primary hover:bg-app-primary/90 text-white rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50"
                id="btn-save-catalog"
              >
                {loading ? 'Guardando...' : editingId ? 'Actualizar Registro' : 'Guardar en Catálogo'}
              </button>
            </div>
          </form>
        </div>

        {/* Catalog List */}
        <div className="ticket-perforated p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-app-border pb-4 mb-4">
            <h3 className="text-xs font-bold text-app-text uppercase tracking-wider">
              Registros Existentes en {
                activeTab === 'providers' ? 'Proveedores' :
                activeTab === 'articles' ? 'Artículos (Telas)' :
                activeTab === 'clients' ? 'Clientes' : 'Vendedores'
              }
            </h3>
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-app-text/50">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder={`Buscar ${
                  activeTab === 'providers' ? 'proveedor...' :
                  activeTab === 'articles' ? 'tela o descripción...' :
                  activeTab === 'clients' ? 'cliente, RUC/DNI...' : 'vendedor...'
                }`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 border border-app-border rounded bg-app-surface text-app-text text-xs focus:outline-hidden focus:ring-1 focus:ring-app-primary placeholder:text-app-text/45"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-app-text/50 hover:text-app-text"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'providers' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-bg/40 border-b border-app-border text-xs text-app-text/60 uppercase font-semibold">
                    <th className="p-3">Nombre del Proveedor</th>
                    <th className="p-3">Lote</th>
                    <th className="p-3">Partida</th>
                    <th className="p-3">Tono</th>
                    <th className="p-3">Nº Rollo</th>
                    <th className="p-3">Ancho</th>
                    <th className="p-3">Peso</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/40 text-sm bg-app-surface">
                  {providers.filter(p => {
                    const q = searchQuery.toLowerCase().trim();
                    if (!q) return true;
                    return p.name.toLowerCase().includes(q);
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-center text-app-text/45">
                        {providers.length === 0 ? 'No hay proveedores registrados.' : 'No se encontraron resultados para la búsqueda.'}
                      </td>
                    </tr>
                  ) : (
                    providers.filter(p => {
                      const q = searchQuery.toLowerCase().trim();
                      if (!q) return true;
                      return p.name.toLowerCase().includes(q);
                    }).map(p => (
                      <tr key={p.id} className="hover:bg-app-bg/40 border-b border-app-border/60 text-xs">
                        <td className="p-3 font-semibold text-app-text">{p.name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold border ${p.hasLot ? 'bg-app-bg text-app-text border-app-border' : 'bg-app-surface text-app-text/40 border-app-border/40'}`}>
                            {p.hasLot ? 'SÍ' : 'NO'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold border ${p.hasPartida ? 'bg-app-bg text-app-text border-app-border' : 'bg-app-surface text-app-text/40 border-app-border/40'}`}>
                            {p.hasPartida ? 'SÍ' : 'NO'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold border ${p.hasTono ? 'bg-app-bg text-app-text border-app-border' : 'bg-app-surface text-app-text/40 border-app-border/40'}`}>
                            {p.hasTono ? 'SÍ' : 'NO'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold border ${(p.hasRollNo ?? true) ? 'bg-app-bg text-app-text border-app-border' : 'bg-app-surface text-app-text/40 border-app-border/40'}`}>
                            {(p.hasRollNo ?? true) ? 'SÍ' : 'NO'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold border ${p.hasWidth ? 'bg-app-bg text-app-text border-app-border' : 'bg-app-surface text-app-text/40 border-app-border/40'}`}>
                            {p.hasWidth ? 'SÍ' : 'NO'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold border ${p.hasWeight ? 'bg-app-bg text-app-text border-app-border' : 'bg-app-surface text-app-text/40 border-app-border/40'}`}>
                            {p.hasWeight ? 'SÍ' : 'NO'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleEditInit('providers', p)}
                              className="p-1.5 hover:bg-app-bg text-app-text/60 hover:text-app-text rounded transition cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete('providers', p.id)}
                              className="p-1.5 hover:bg-red-50 text-app-text/45 hover:text-red-600 rounded transition cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'articles' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-bg/40 border-b border-app-border text-xs text-app-text/60 uppercase font-semibold">
                    <th className="p-3">Nombre Tela / Artículo</th>
                    <th className="p-3">Descripción / Gramaje</th>
                    <th className="p-3">Proveedor Asociado</th>
                    <th className="p-3">Unidad</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/40 text-sm bg-app-surface">
                  {articles.filter(a => {
                    const q = searchQuery.toLowerCase().trim();
                    if (!q) return true;
                    const prov = providers.find(p => p.id === a.providerId);
                    return (
                      a.name.toLowerCase().includes(q) ||
                      (a.description || '').toLowerCase().includes(q) ||
                      (prov?.name || '').toLowerCase().includes(q)
                    );
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-app-text/45">
                        {articles.length === 0 ? 'No hay artículos registrados.' : 'No se encontraron resultados para la búsqueda.'}
                      </td>
                    </tr>
                  ) : (
                    articles.filter(a => {
                      const q = searchQuery.toLowerCase().trim();
                      if (!q) return true;
                      const prov = providers.find(p => p.id === a.providerId);
                      return (
                        a.name.toLowerCase().includes(q) ||
                        (a.description || '').toLowerCase().includes(q) ||
                        (prov?.name || '').toLowerCase().includes(q)
                      );
                    }).map(a => {
                      const prov = providers.find(p => p.id === a.providerId);
                      return (
                        <tr key={a.id} className="hover:bg-app-bg/40 border-b border-app-border/60 text-xs">
                          <td className="p-3 font-semibold text-app-text">{a.name}</td>
                          <td className="p-3 text-app-text/60">{a.description || '-'}</td>
                          <td className="p-3 font-medium text-app-text/90">{prov?.name || 'Cargando...'}</td>
                          <td className="p-3 text-xs font-mono text-app-text/60">{a.unit}</td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleEditInit('articles', a)}
                                className="p-1.5 hover:bg-app-bg text-app-text/60 hover:text-app-text rounded transition cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete('articles', a.id)}
                                className="p-1.5 hover:bg-red-50 text-app-text/45 hover:text-red-600 rounded transition cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'clients' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-bg/40 border-b border-app-border text-xs text-app-text/60 uppercase font-semibold">
                    <th className="p-3">Cliente / Razón Social</th>
                    <th className="p-3">DNI / RUC</th>
                    <th className="p-3">Contacto</th>
                    <th className="p-3">Dirección de Despacho</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/40 text-sm bg-app-surface">
                  {clients.filter(c => {
                    const q = searchQuery.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      c.name.toLowerCase().includes(q) ||
                      (c.dni || '').toLowerCase().includes(q) ||
                      (c.email || '').toLowerCase().includes(q) ||
                      (c.phone || '').toLowerCase().includes(q) ||
                      (c.address || '').toLowerCase().includes(q)
                    );
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-app-text/45">
                        {clients.length === 0 ? 'No hay clientes registrados.' : 'No se encontraron resultados para la búsqueda.'}
                      </td>
                    </tr>
                  ) : (
                    clients.filter(c => {
                      const q = searchQuery.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        c.name.toLowerCase().includes(q) ||
                        (c.dni || '').toLowerCase().includes(q) ||
                        (c.email || '').toLowerCase().includes(q) ||
                        (c.phone || '').toLowerCase().includes(q) ||
                        (c.address || '').toLowerCase().includes(q)
                      );
                    }).map(c => (
                      <tr key={c.id} className="hover:bg-app-bg/40 border-b border-app-border/60 text-xs">
                        <td className="p-3 font-semibold text-app-text">{c.name}</td>
                        <td className="p-3 font-mono text-xs text-app-text/90">{c.dni}</td>
                        <td className="p-3 text-xs">
                          {c.email && <div className="text-app-text/60 font-mono">{c.email}</div>}
                          {c.phone && <div className="text-app-text/50">{c.phone}</div>}
                        </td>
                        <td className="p-3 text-xs text-app-text/60 max-w-xs truncate" title={c.address}>{c.address || '-'}</td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleEditInit('clients', c)}
                              className="p-1.5 hover:bg-app-bg text-app-text/60 hover:text-app-text rounded transition cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete('clients', c.id)}
                              className="p-1.5 hover:bg-red-50 text-app-text/45 hover:text-red-600 rounded transition cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'sellers' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-app-bg/40 border-b border-app-border text-xs text-app-text/60 uppercase font-semibold">
                    <th className="p-3">Nombre del Vendedor</th>
                    <th className="p-3">Correo Electrónico</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/40 text-sm bg-app-surface">
                  {sellers.filter(s => {
                    const q = searchQuery.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      s.name.toLowerCase().includes(q) ||
                      (s.email || '').toLowerCase().includes(q) ||
                      (s.phone || '').toLowerCase().includes(q)
                    );
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-app-text/45">
                        {sellers.length === 0 ? 'No hay vendedores registrados.' : 'No se encontraron resultados para la búsqueda.'}
                      </td>
                    </tr>
                  ) : (
                    sellers.filter(s => {
                      const q = searchQuery.toLowerCase().trim();
                      if (!q) return true;
                      return (
                        s.name.toLowerCase().includes(q) ||
                        (s.email || '').toLowerCase().includes(q) ||
                        (s.phone || '').toLowerCase().includes(q)
                      );
                    }).map(s => (
                      <tr key={s.id} className="hover:bg-app-bg/40 border-b border-app-border/60 text-xs">
                        <td className="p-3 font-semibold text-app-text">{s.name}</td>
                        <td className="p-3 text-xs font-mono text-app-text/90">{s.email || '-'}</td>
                        <td className="p-3 text-xs text-app-text/60">{s.phone || '-'}</td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleEditInit('sellers', s)}
                              className="p-1.5 hover:bg-app-bg text-app-text/60 hover:text-app-text rounded transition cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete('sellers', s.id)}
                              className="p-1.5 hover:bg-red-50 text-app-text/45 hover:text-red-600 rounded transition cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
