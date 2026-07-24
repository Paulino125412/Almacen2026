import React, { useState, useEffect, useMemo } from 'react';
import { Client, Seller, Provider, Article, RollItem, PackingList, PackingListItem } from '../types';
import { db, addDoc, updateDoc } from '../firebase';
import { collection, doc } from 'firebase/firestore';
import { Plus, Trash2, Calendar, User, ShoppingBag, CheckCircle2, ChevronRight, Hash, Ruler, X, FileText, Layers, Truck } from 'lucide-react';
import SearchableCombobox from './SearchableCombobox';
import { FormRollEntry, FormArticleGroup } from './packing-list-form/types';
import { resolveColumnsForText } from './packing-list-form/ExcelPasteParser';
import ClientSellerSelector from './packing-list-form/ClientSellerSelector';
import ArticleGroupSection from './packing-list-form/ArticleGroupSection';
import AlertBanner from './AlertBanner';

interface PackingListFormProps {
  clients: Client[];
  sellers: Seller[];
  providers: Provider[];
  articles: Article[];
  inventory: RollItem[];
  packingLists: PackingList[];
  onRefresh: () => Promise<void>;
  onPackingListCreated: (pl: PackingList) => void;
  currentOperator: string;
  editingPackingList?: PackingList | null;
  isDuplicate?: boolean;
  onCancelEdit?: (goToHistory?: boolean) => void;
}

// Helper to calculate consecutive, non-repeating Packing List numbers
const getNextPackingListNo = (existingLists: PackingList[]) => {
  if (!existingLists || existingLists.length === 0) {
    return 'PL-0001';
  }
  
  let maxNum = 0;
  existingLists.forEach(pl => {
    const match = pl.packingListNo.match(/^PL-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    } else {
      const digitsMatch = pl.packingListNo.match(/\d+/);
      if (digitsMatch) {
        const num = parseInt(digitsMatch[0], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  });
  
  if (maxNum === 0) {
    maxNum = existingLists.length;
  }
  
  const nextNum = maxNum + 1;
  return `PL-${String(nextNum).padStart(4, '0')}`;
};

export default function PackingListForm({
  clients,
  sellers,
  providers,
  articles,
  inventory,
  packingLists,
  onRefresh,
  onPackingListCreated,
  currentOperator,
  editingPackingList = null,
  isDuplicate = false,
  onCancelEdit
}: PackingListFormProps) {
  const [packingType, setPackingType] = useState<'nuevo' | 'antiguo' | 'corte'>('nuevo');
  const [clientId, setClientId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [docDate, setDocDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [packingListNo, setPackingListNo] = useState(() => getNextPackingListNo(packingLists));
  const [notes, setNotes] = useState('');
  const [formProviderId, setFormProviderId] = useState('');
  const [guideNumber, setGuideNumber] = useState('');
  const [dispatchAddress, setDispatchAddress] = useState('');
  
  // Nested structure state: Article Sections containing multiple rolls
  const [articleGroups, setArticleGroups] = useState<FormArticleGroup[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [hasCheckedDraft, setHasCheckedDraft] = useState(false);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false);
  const [draftData, setDraftData] = useState<any>(null);
  const [isSuccessfullySaved, setIsSuccessfullySaved] = useState(false);

  // Reset confirmation state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Form content presence check
  const hasContent = useMemo(() => {
    return !!(
      clientId || 
      sellerId ||
      notes.trim() || 
      formProviderId || 
      guideNumber.trim() || 
      dispatchAddress.trim() || 
      articleGroups.length > 1 || 
      (articleGroups[0] && (articleGroups[0].articleId || articleGroups[0].rolls.length > 0))
    );
  }, [clientId, sellerId, notes, formProviderId, guideNumber, dispatchAddress, articleGroups]);

  // Reusable function to completely reset form state
  const resetFormState = () => {
    setClientId('');
    setSellerId('');
    setNotes('');
    setFormProviderId('');
    setGuideNumber('');
    setDispatchAddress('');
    setDocDate(new Date().toISOString().split('T')[0]);
    setPackingType('nuevo');
    setPackingListNo(getNextPackingListNo(packingLists));
    setArticleGroups([
      {
        id: `group-${Date.now()}-${Math.random()}`,
        providerId: '',
        articleId: '',
        lot: '',
        partida: '',
        tono: '',
        source: 'custom',
        rolls: []
      }
    ]);
  };

  const handleConfirmReset = () => {
    resetFormState();
    localStorage.removeItem("texflow_draft_packinglist");
    if (editingPackingList || isDuplicate) {
      onCancelEdit?.(false);
    }
    setIsResetConfirmOpen(false);
  };

  // Check for saved draft on mount (only if not editing or duplicating)
  useEffect(() => {
    if (!editingPackingList && !isDuplicate) {
      try {
        const saved = localStorage.getItem("texflow_draft_packinglist");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.clientId || parsed.sellerId || parsed.notes || (parsed.articleGroups && parsed.articleGroups.length > 0 && parsed.articleGroups.some((g: any) => g.articleId || g.rolls?.length > 0)))) {
            setDraftData(parsed);
            setShowRecoveryPrompt(true);
            return;
          }
        }
      } catch (e) {
        console.error("Error reading draft from localStorage", e);
      }
    }
    setHasCheckedDraft(true);
  }, [editingPackingList, isDuplicate]);

  const handleRecoverDraft = () => {
    if (draftData) {
      if (draftData.packingType) setPackingType(draftData.packingType);
      if (draftData.clientId) setClientId(draftData.clientId);
      if (draftData.sellerId) setSellerId(draftData.sellerId);
      if (draftData.docDate) setDocDate(draftData.docDate);
      if (draftData.notes) setNotes(draftData.notes);
      if (draftData.formProviderId) setFormProviderId(draftData.formProviderId);
      if (draftData.articleGroups) setArticleGroups(draftData.articleGroups);
      if (draftData.guideNumber) setGuideNumber(draftData.guideNumber);
      if (draftData.dispatchAddress) setDispatchAddress(draftData.dispatchAddress);
    }
    setShowRecoveryPrompt(false);
    setHasCheckedDraft(true);
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem("texflow_draft_packinglist");
    setShowRecoveryPrompt(false);
    setHasCheckedDraft(true);
  };

  // Auto-save form draft to localStorage when states change
  useEffect(() => {
    if (hasCheckedDraft && !editingPackingList && !isDuplicate) {
      if (hasContent) {
        const draftObj = {
          packingType,
          clientId,
          sellerId,
          docDate,
          notes,
          formProviderId,
          articleGroups,
          guideNumber,
          dispatchAddress
        };
        localStorage.setItem("texflow_draft_packinglist", JSON.stringify(draftObj));
      } else {
        localStorage.removeItem("texflow_draft_packinglist");
      }
    }
  }, [hasCheckedDraft, hasContent, packingType, clientId, sellerId, docDate, notes, formProviderId, articleGroups, editingPackingList, isDuplicate, guideNumber, dispatchAddress]);

  // Reset success save status when editing/duplicating changes or form fields are modified
  useEffect(() => {
    setIsSuccessfullySaved(false);
  }, [editingPackingList, isDuplicate]);

  // Native browser beforeunload warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnsavedContent =
        clientId !== '' ||
        sellerId !== '' ||
        notes.trim() !== '' ||
        guideNumber.trim() !== '' ||
        dispatchAddress.trim() !== '' ||
        articleGroups.some(g => 
          g.articleId || 
          g.providerId || 
          g.lot || 
          g.partida || 
          g.tono || 
          (g.rolls && g.rolls.length > 0)
        );

      if (hasUnsavedContent && !isSuccessfullySaved) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [clientId, sellerId, notes, guideNumber, dispatchAddress, articleGroups, isSuccessfullySaved]);

  // Propagate formProviderId to all article groups and reset incompatible ones
  useEffect(() => {
    if (formProviderId && !editingPackingList) {
      setArticleGroups(prev => prev.map(g => {
        if (g.providerId !== formProviderId) {
          const matchingArticles = articles.filter(a => a.providerId === formProviderId);
          return {
            ...g,
            providerId: formProviderId,
            articleId: matchingArticles.length === 1 ? matchingArticles[0].id : '',
            lot: '',
            partida: '',
            tono: '',
            rolls: []
          };
        }
        return g;
      }));
    }
  }, [formProviderId, articles, editingPackingList]);

  // Generate unique correlative document number
  useEffect(() => {
    if (!editingPackingList || isDuplicate) {
      setPackingListNo(getNextPackingListNo(packingLists));
    }
  }, [packingLists, editingPackingList, isDuplicate]);

  // Prefill form for Editing / Duplicating
  useEffect(() => {
    if (editingPackingList) {
      const clientObj = clients.find(c => c.id === editingPackingList.clientId || c.name === editingPackingList.clientId);
      const sellerObj = sellers.find(s => s.id === editingPackingList.sellerId || s.name === editingPackingList.sellerId);

      setPackingType(editingPackingList.type as any);
      setClientId(clientObj ? clientObj.id : (editingPackingList.clientId || ''));
      setSellerId(sellerObj ? sellerObj.id : (editingPackingList.sellerId || ''));
      setGuideNumber(editingPackingList.guideNumber || '');
      setDispatchAddress(editingPackingList.dispatchAddress || '');
      
      // If duplicating, keep current date and get next sequential PL No. Otherwise, keep the original ones.
      if (isDuplicate) {
        setDocDate(new Date().toISOString().split('T')[0]);
        setPackingListNo(getNextPackingListNo(packingLists));
      } else {
        setDocDate(editingPackingList.date || new Date().toISOString().split('T')[0]);
        setPackingListNo(editingPackingList.packingListNo || '');
      }
      
      setNotes(editingPackingList.notes || '');
      
      // Determine formProviderId from the first item if available, resolving from articles if missing
      const plItems = editingPackingList.items || [];
      const firstItem = plItems[0];
      const firstArticle = firstItem ? articles.find(a => a.id === firstItem.articleId || a.name === firstItem.articleId) : null;
      const firstProvider = firstItem ? providers.find(p => p.id === firstItem.providerId || p.name === firstItem.providerId) : null;
      const initialProviderId = firstProvider?.id || firstItem?.providerId || (firstArticle ? firstArticle.providerId : '');
      setFormProviderId(initialProviderId);

      // Group items by providerId + articleId
      const groupsMap: Record<string, FormArticleGroup> = {};
      plItems.forEach((item, itemIdx) => {
        const articleObj = articles.find(a => a.id === item.articleId || a.name === item.articleId);
        const resolvedArticleId = articleObj ? articleObj.id : (item.articleId || '');

        const providerObj = providers.find(p => p.id === item.providerId || p.name === item.providerId) || 
                            (articleObj ? providers.find(p => p.id === articleObj.providerId) : null);
        const resolvedProviderId = providerObj ? providerObj.id : (item.providerId || initialProviderId);

        const groupKey = `${resolvedProviderId || 'no-prov'}-${resolvedArticleId || 'no-art'}`;

        if (!groupsMap[groupKey]) {
          groupsMap[groupKey] = {
            id: `group-prefill-${resolvedProviderId}-${resolvedArticleId}-${itemIdx}-${Math.random()}`,
            providerId: resolvedProviderId,
            articleId: resolvedArticleId,
            lot: item.lot || '',
            partida: item.partida || '',
            tono: item.tono || '',
            source: item.rollId ? 'inventory' : 'custom',
            rolls: [],
            hasProcessedExcel: false
          };
        }
        
        // Find max meters (current inventory stock + the meters allocated to this PL item if editing)
        const rollInInv = item.rollId ? inventory.find(inv => inv.id === item.rollId) : null;
        let maxMeters: number | undefined;
        if (item.rollId) {
          maxMeters = (rollInInv?.currentMeters || 0) + (isDuplicate ? 0 : item.meters);
        }

        groupsMap[groupKey].rolls.push({
          id: item.id || `roll-prefill-${itemIdx}-${Math.random()}`,
          rollId: item.rollId,
          rollNumber: item.rollNumber || '',
          meters: item.meters || 0,
          maxMeters,
          lot: item.lot || '',
          partida: item.partida || '',
          tono: item.tono || '',
          width: item.width || '',
          weight: item.weight || ''
        });
      });

      let reconstructedGroups = Object.values(groupsMap).map(group => {
        const pConfig = providers.find(p => p.id === group.providerId) || null;
        const isExcelOnly = !!(pConfig && (pConfig.hasRollNo ?? true) && pConfig.hasWidth && pConfig.hasWeight);
        const hasRowData = group.rolls.some(r => 
          Boolean(
            (r.lot && r.lot.trim() !== '') ||
            (r.partida && r.partida.trim() !== '') ||
            (r.tono && r.tono.trim() !== '') ||
            (r.width && r.width.trim() !== '') ||
            (r.weight && r.weight.trim() !== '')
          )
        );

        return {
          ...group,
          hasProcessedExcel: isExcelOnly || hasRowData
        };
      });

      if (reconstructedGroups.length === 0) {
        reconstructedGroups = [
          {
            id: `group-${Date.now()}-${Math.random()}`,
            providerId: initialProviderId,
            articleId: '',
            lot: '',
            partida: '',
            tono: '',
            source: 'custom',
            rolls: [],
            hasProcessedExcel: false
          }
        ];
      }

      setArticleGroups(reconstructedGroups);
    } else {
      // Clear form when editingPackingList is null
      setPackingType('nuevo');
      setClientId('');
      setSellerId('');
      setDocDate(new Date().toISOString().split('T')[0]);
      setPackingListNo(getNextPackingListNo(packingLists));
      setNotes('');
      setFormProviderId('');
      setGuideNumber('');
      setDispatchAddress('');
      setArticleGroups([
        {
          id: `group-${Date.now()}-${Math.random()}`,
          providerId: '',
          articleId: '',
          lot: '',
          partida: '',
          tono: '',
          source: 'custom',
          rolls: [],
          hasProcessedExcel: false
        }
      ]);
    }
  }, [editingPackingList, isDuplicate, packingLists, providers, inventory, articles, clients, sellers]);

  // Filter available inventory rolls
  const availableRolls = useMemo(() => {
    return inventory.filter(r => r.currentMeters > 0);
  }, [inventory]);

  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    if (newClientId) {
      const selectedClient = clients.find(c => c.id === newClientId);
      if (selectedClient && selectedClient.address) {
        setDispatchAddress(selectedClient.address);
      } else {
        setDispatchAddress('');
      }
    } else {
      setDispatchAddress('');
    }
  };

  // Save new client on the fly
  const handleAddNewClient = async (name: string, fields: Record<string, string>): Promise<string> => {
    try {
      const newClientData = {
        name,
        dni: fields.dni || '',
        email: fields.email || '',
        phone: fields.phone || '',
        address: fields.address || '',
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'clients'), newClientData);
      await onRefresh(); // Refresh data to update parent's clients list
      if (newClientData.address) {
        setDispatchAddress(newClientData.address);
      }
      return docRef.id;
    } catch (err) {
      console.error("Error creating client on the fly:", err);
      throw new Error("No se pudo registrar el cliente. Verifique su conexión.");
    }
  };

  // Save new seller on the fly
  const handleAddNewSeller = async (name: string, fields: Record<string, string>): Promise<string> => {
    try {
      const newSellerData = {
        name,
        email: fields.email || '',
        phone: fields.phone || '',
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'sellers'), newSellerData);
      await onRefresh(); // Refresh data to update parent's sellers list
      return docRef.id;
    } catch (err) {
      console.error("Error creating seller on the fly:", err);
      throw new Error("No se pudo registrar el vendedor. Verifique su conexión.");
    }
  };

  // Save new provider on the fly
  const handleAddNewProvider = async (name: string, fields: Record<string, string>): Promise<string> => {
    try {
      const hasLot = fields.hasLot ? fields.hasLot.trim().toLowerCase() !== 'no' : true;
      const hasPartida = fields.hasPartida ? fields.hasPartida.trim().toLowerCase() !== 'no' : true;
      const hasTono = fields.hasTono ? fields.hasTono.trim().toLowerCase() !== 'no' : true;
      
      const newProviderData = {
        name,
        hasLot,
        hasPartida,
        hasTono,
        hasRollNo: true,
        hasWidth: false,
        hasWeight: false,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'providers'), newProviderData);
      await onRefresh(); // Refresh data to update parent's providers list
      setFormProviderId(docRef.id);
      return docRef.id;
    } catch (err) {
      console.error("Error creating provider on the fly:", err);
      throw new Error("No se pudo registrar el proveedor. Verifique su conexión.");
    }
  };

  // Save new article on the fly
  const handleAddNewArticle = async (name: string, fields: Record<string, string>): Promise<string> => {
    try {
      if (!formProviderId) {
        throw new Error("Debe seleccionar un Proveedor primero antes de registrar un nuevo artículo.");
      }
      const newArticleData = {
        name,
        description: fields.description || '',
        unit: 'metros',
        providerId: formProviderId,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'articles'), newArticleData);
      await onRefresh(); // Refresh data to update parent's articles list
      return docRef.id;
    } catch (err: any) {
      console.error("Error creating article on the fly:", err);
      throw new Error(err.message || "No se pudo registrar el artículo. Verifique su conexión.");
    }
  };

  // Initial group setup (start with 1 empty article group)
  useEffect(() => {
    if (articleGroups.length === 0) {
      const activeProvId = formProviderId || '';
      const matchingArticles = articles.filter(a => a.providerId === activeProvId);
      const defaultArticleId = matchingArticles.length === 1 ? matchingArticles[0].id : '';

      const newGroup: FormArticleGroup = {
        id: `group-${Date.now()}-${Math.random()}`,
        providerId: activeProvId,
        articleId: defaultArticleId,
        lot: '',
        partida: '',
        tono: '',
        source: 'custom',
        rolls: []
      };
      setArticleGroups([newGroup]);
    }
  }, []);

  const handleAddArticleGroup = () => {
    const activeProvId = formProviderId || '';
    const matchingArticles = articles.filter(a => a.providerId === activeProvId);
    const defaultArticleId = matchingArticles.length === 1 ? matchingArticles[0].id : '';

    const newGroup: FormArticleGroup = {
      id: `group-${Date.now()}-${Math.random()}`,
      providerId: activeProvId,
      articleId: defaultArticleId,
      lot: '',
      partida: '',
      tono: '',
      source: 'custom',
      rolls: []
    };
    setArticleGroups(prev => [...prev, newGroup]);
  };

  const handleRemoveArticleGroup = (groupId: string) => {
    if (articleGroups.length <= 1) {
      alert('Debe incluir al menos un artículo en el Packing List.');
      return;
    }
    setArticleGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleRollKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, groupId: string, rollIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRollToGroup(groupId);
      setTimeout(() => {
        const nextInput = document.getElementById(`meters-${groupId}-${rollIndex + 1}`) as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }, 80);
    }
  };

  const handleAddRollToGroup = (groupId: string) => {
    setArticleGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        // Suggest next roll or cut number
        const rollsCount = g.rolls.length;
        let nextRollNumber = packingType === 'nuevo' ? `ROLLO-${rollsCount + 1}` : `CORTE-${rollsCount + 1}`;
        
        const lastRollNum = g.rolls[rollsCount - 1]?.rollNumber || '';
        if (lastRollNum) {
          const match = lastRollNum.match(/^(.*?)(\d+)$/);
          if (match) {
            const prefix = match[1];
            const num = parseInt(match[2], 10) + 1;
            nextRollNumber = `${prefix}${num}`;
          }
        }

        return {
          ...g,
          rolls: [
            ...g.rolls,
            {
              id: `roll-${Date.now()}-${Math.random()}`,
              rollNumber: nextRollNumber,
              meters: packingType === 'nuevo' ? 50 : 0,
              lot: g.lot || '',
              partida: g.partida || '',
              tono: g.tono || '',
              width: '',
              weight: ''
            }
          ]
        };
      }
      return g;
    }));
  };

  const handleRemoveRollFromGroup = (groupId: string, rollId: string) => {
    setArticleGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          rolls: g.rolls.filter(r => r.id !== rollId)
        };
      }
      return g;
    }));
  };

  const handleAddScannedRollToGroup = (groupId: string, scan: {
    rollNumber: string;
    meters?: number;
    lot?: string;
    partida?: string;
    tono?: string;
    width?: string;
    weight?: string;
    rollId?: string;
    maxMeters?: number;
  }) => {
    setArticleGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        // Custom manual roll scan entry
        return {
          ...g,
          rolls: [
            ...g.rolls,
            {
              id: `roll-${Date.now()}-${Math.random()}`,
              rollNumber: scan.rollNumber,
              rollId: scan.rollId,
              meters: scan.meters !== undefined ? scan.meters : (packingType === 'nuevo' ? 50 : 0),
              maxMeters: scan.maxMeters,
              lot: scan.lot || g.lot || '',
              partida: scan.partida || g.partida || '',
              tono: scan.tono || g.tono || '',
              width: scan.width || '',
              weight: scan.weight || ''
            }
          ]
        };
      }
      return g;
    }));
  };

  const handleProcessUnifiedInput = (groupId: string, textToProcess?: string) => {
    const text = (textToProcess !== undefined ? textToProcess : '').trim();
    if (!text) return;

    // Check if the provider has specific fields configured
    const group = articleGroups.find(g => g.id === groupId);
    if (!group) return;
    const pConfig = providers.find(p => p.id === group.providerId);

    const resolution = resolveColumnsForText(text, pConfig);
    const {
      metersColIdx,
      rollColIdx,
      lotColIdx,
      partidaColIdx,
      tonoColIdx,
      widthColIdx,
      weightColIdx,
      startLineIndex,
      lines,
      splitIntoColumns
    } = resolution;

    const parseMetersVal = (val: string): number | null => {
      if (!val) return null;
      let clean = val.trim();
      // Remove trailing units like m, mts, mt, etc.
      clean = clean.replace(/m|mts|mt/i, '').trim();
      if (/[a-zA-Z]/g.test(clean)) {
        return null;
      }
      clean = clean.replace(',', '.');
      const n = parseFloat(clean);
      return isNaN(n) ? null : n;
    };

    interface ParsedRow {
      rollNumber?: string;
      meters: number;
      lot?: string;
      partida?: string;
      tono?: string;
      width?: string;
      weight?: string;
    }

    const parsedRows: ParsedRow[] = [];

    for (let i = startLineIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = splitIntoColumns(line);
      if (cols.length === 0) continue;

      let rowMeters: number | null = null;
      let rowRollNum = '';
      let rowLot = '';
      let rowPartida = '';
      let rowTono = '';
      let rowWidth = '';
      let rowWeight = '';

      if (metersColIdx !== -1 && cols[metersColIdx] !== undefined) {
        rowMeters = parseMetersVal(cols[metersColIdx]);
        if (rollColIdx !== -1 && cols[rollColIdx]) rowRollNum = cols[rollColIdx];
        if (lotColIdx !== -1 && cols[lotColIdx]) rowLot = cols[lotColIdx];
        if (partidaColIdx !== -1 && cols[partidaColIdx]) rowPartida = cols[partidaColIdx];
        if (tonoColIdx !== -1 && cols[tonoColIdx]) rowTono = cols[tonoColIdx];
        if (widthColIdx !== -1 && cols[widthColIdx]) rowWidth = cols[widthColIdx].replace(/m|mts|mt/i, '').trim();
        if (weightColIdx !== -1 && cols[weightColIdx]) rowWeight = cols[weightColIdx].replace(/kg|kgs/i, '').trim();
      }

      if (rowMeters !== null && rowMeters > 0) {
        parsedRows.push({
          rollNumber: rowRollNum || undefined,
          meters: Number(rowMeters.toFixed(2)),
          lot: rowLot || undefined,
          partida: rowPartida || undefined,
          tono: rowTono || undefined,
          width: rowWidth || undefined,
          weight: rowWeight || undefined
        });
      }
    }

    if (parsedRows.length === 0) {
      alert("No se encontraron metrajes válidos. Ingrese un número o pegue una tabla desde Excel.");
      return;
    }

    setArticleGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        let rollsCount = g.rolls.length;
        const newRolls = [...g.rolls];
        
        let lotUpdated = g.lot;
        let partidaUpdated = g.partida;
        let tonoUpdated = g.tono;

        const isExcelOrBulk = lines.length > 1 || text.includes('\t') || text.includes(';') || /\s{2,}/.test(text);

        parsedRows.forEach(row => {
          if (row.lot && pConfig?.hasLot) lotUpdated = row.lot;
          if (row.partida && pConfig?.hasPartida) partidaUpdated = row.partida;
          if (row.tono && pConfig?.hasTono) tonoUpdated = row.tono;

          let finalRollNum = row.rollNumber;
          if (!finalRollNum) {
            finalRollNum = packingType === 'corte' ? `CORTE-${rollsCount + 1}` : `ROLLO-${rollsCount + 1}`;
            const lastRollNum = newRolls[newRolls.length - 1]?.rollNumber || '';
            if (lastRollNum) {
              const match = lastRollNum.match(/^(.*?)(\d+)$/);
              if (match) {
                const prefix = match[1];
                const num = parseInt(match[2], 10) + 1;
                finalRollNum = `${prefix}${num}`;
              }
            }
          }

          newRolls.push({
            id: `roll-${Date.now()}-${Math.random()}-${rollsCount}`,
            rollNumber: finalRollNum,
            meters: row.meters,
            lot: row.lot || g.lot || '',
            partida: row.partida || g.partida || '',
            tono: row.tono || g.tono || '',
            width: row.width || '',
            weight: row.weight || ''
          });
          rollsCount++;
        });

        return {
          ...g,
          lot: isExcelOrBulk ? '' : g.lot,
          partida: isExcelOrBulk ? '' : g.partida,
          tono: isExcelOrBulk ? '' : g.tono,
          hasProcessedExcel: isExcelOrBulk ? true : g.hasProcessedExcel,
          rolls: newRolls
        };
      }
      return g;
    }));
  };

  const handleGroupFieldChange = (groupId: string, field: keyof FormArticleGroup, value: any) => {
    setArticleGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        if (field === 'providerId') {
          const matchingArticles = articles.filter(a => a.providerId === value);
          const nextArticleId = matchingArticles[0]?.id || '';
          return {
            ...g,
            providerId: value,
            articleId: nextArticleId,
            lot: '',
            partida: '',
            tono: '',
            hasProcessedExcel: false,
            rolls: []
          };
        }
        if (field === 'articleId') {
          return {
            ...g,
            articleId: value,
            hasProcessedExcel: false,
            rolls: []
          };
        }
        if (field === 'source') {
          // Reset roll configuration with empty rolls array
          return {
            ...g,
            source: value,
            hasProcessedExcel: false,
            rolls: []
          };
        }
        
        // Master inputs lot, partida, and tono are updated here and will only be applied to newly created rolls.
        return { ...g, [field]: value };
      }
      return g;
    }));
  };

  const handleRollFieldChange = (groupId: string, rollId: string, field: keyof FormRollEntry, value: any) => {
    setArticleGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          rolls: g.rolls.map(r => {
            if (r.id === rollId) {
              if (field === 'rollId') {
                const warehouseRoll = inventory.find(wr => wr.id === value);
                if (warehouseRoll) {
                  return {
                    ...r,
                    rollId: warehouseRoll.id,
                    rollNumber: warehouseRoll.rollNumber,
                    meters: warehouseRoll.currentMeters,
                    maxMeters: warehouseRoll.currentMeters
                  };
                }
              }
              return { ...r, [field]: value };
            }
            return r;
          })
        };
      }
      return g;
    }));
  };

  const getProviderConfig = (providerId: string) => {
    return providers.find(p => p.id === providerId) || null;
  };

  // Submit and Save
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);

    // Header validations
    if (!clientId) {
      setError('Por favor seleccione el Cliente.');
      return;
    }
    if (!sellerId) {
      setError('Por favor seleccione el Vendedor.');
      return;
    }
    if (!formProviderId) {
      setError('Por favor seleccione el Proveedor.');
      return;
    }
    if (!packingListNo.trim()) {
      setError('El número de packing list es obligatorio.');
      return;
    }

    const isDuplicatePLNo = packingLists.some(pl => {
      if (editingPackingList && !isDuplicate && pl.id === editingPackingList.id) {
        return false;
      }
      return pl.packingListNo.trim().toLowerCase() === packingListNo.trim().toLowerCase();
    });

    if (isDuplicatePLNo) {
      setError(`Ya existe un Packing List con el número "${packingListNo.trim()}". Use un número diferente.`);
      return;
    }

    // Article groups validations
    for (let gIdx = 0; gIdx < articleGroups.length; gIdx++) {
      const g = articleGroups[gIdx];
      if (!g.articleId) {
        setError(`Artículo #${gIdx + 1}: Debe seleccionar un Artículo.`);
        return;
      }

      if (g.rolls.length === 0) {
        setError(`Artículo #${gIdx + 1}: Debe ingresar al menos un metraje/rollo usando el casillero de ingreso rápido.`);
        return;
      }

      const config = getProviderConfig(g.providerId);
      
      // Validate dynamic attributes if required by provider (only for 'nuevo' or legacy 'rollo')
      if ((packingType === 'nuevo' || packingType === 'rollo') && g.source === 'custom' && config) {
        for (let rIdx = 0; rIdx < g.rolls.length; rIdx++) {
          const r = g.rolls[rIdx];
          if (config.hasLot && !r.lot?.trim() && !g.lot.trim() && !g.hasProcessedExcel) {
            setError(`Artículo #${gIdx + 1}, Cantidad #${rIdx + 1}: El campo Lote es obligatorio.`);
            return;
          }
          if (config.hasPartida && !r.partida?.trim() && !g.partida.trim() && !g.hasProcessedExcel) {
            setError(`Artículo #${gIdx + 1}, Cantidad #${rIdx + 1}: El campo Partida es obligatorio.`);
            return;
          }
          if (config.hasTono && !r.tono?.trim() && !g.tono.trim() && !g.hasProcessedExcel) {
            setError(`Artículo #${gIdx + 1}, Cantidad #${rIdx + 1}: El campo Tono es obligatorio.`);
            return;
          }
        }
      }

      // Validate rolls inside this article group
      for (let rIdx = 0; rIdx < g.rolls.length; rIdx++) {
        const r = g.rolls[rIdx];
        if ((packingType === 'nuevo' || packingType === 'rollo') && g.source === 'inventory' && !r.rollId) {
          setError(`Artículo #${gIdx + 1}, Cantidad #${rIdx + 1}: Debe seleccionar un rollo de stock asignado.`);
          return;
        }
        if ((packingType === 'nuevo' || packingType === 'rollo') && g.source === 'custom' && !r.rollNumber.trim() && (!config || (config.hasRollNo ?? true))) {
          setError(`Artículo #${gIdx + 1}, Cantidad #${rIdx + 1}: El identificador/número de rollo es obligatorio.`);
          return;
        }
        if (r.meters <= 0) {
          setError(`Artículo #${gIdx + 1}, Cantidad #${rIdx + 1}: Los metros deben ser mayor a 0.`);
          return;
        }
        if (r.maxMeters && r.meters > r.maxMeters) {
          setError(`Artículo #${gIdx + 1}, Cantidad #${rIdx + 1}: Los metros ingresados (${r.meters}m) superan el stock de almacén disponible para este rollo (${r.maxMeters}m).`);
          return;
        }
      }
    }

    // Validate duplicate rollIds
    const seenRollIds: { [rollId: string]: string } = {};
    for (const g of articleGroups) {
      for (const r of g.rolls) {
        if (r.rollId) {
          if (seenRollIds[r.rollId]) {
            setError(`El rollo '${r.rollNumber}' está siendo usado más de una vez en este despacho. Combina las cantidades en una sola fila o elige un rollo diferente.`);
            return;
          }
          seenRollIds[r.rollId] = r.rollNumber;
        }
      }
    }

    setLoading(true);

    try {
      // Build flattened items array for database storage
      const finalItems: PackingListItem[] = [];
      articleGroups.forEach(g => {
        g.rolls.forEach(r => {
          const item: PackingListItem = {
            id: `pli-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
            rollNumber: r.rollNumber || `ROLLO-DIRECT-${Math.floor(1000 + Math.random() * 9000)}`,
            articleId: g.articleId || '',
            providerId: g.providerId || '',
            meters: Number(r.meters) || 0,
            lot: r.lot || g.lot || '',
            partida: r.partida || g.partida || '',
            tono: r.tono || g.tono || '',
            width: r.width || '',
            weight: r.weight || ''
          };
          if (r.rollId) {
            item.rollId = r.rollId;
          }
          finalItems.push(item);
        });
      });

      const totalMetersValue = finalItems.reduce((acc, item) => acc + Number(item.meters || 0), 0);
      const totalRollsValue = finalItems.length;

      if (finalItems.length === 0 || totalMetersValue <= 0) {
        setError("Debe agregar al menos un rollo o corte con metraje antes de guardar el despacho.");
        setLoading(false);
        return;
      }

      const clientObj = clients.find(c => c.id === clientId);

      if (editingPackingList && !isDuplicate) {
        // --- 1. MODIFICAR/EDITAR PACKING LIST EXISTENTE ---
        
        // A. Primero revertimos el stock e historial de los artículos despachados originalmente
        for (const item of editingPackingList.items) {
          if (item.rollId) {
            const roll = inventory.find(r => r.id === item.rollId);
            if (roll) {
              const revertedMeters = roll.currentMeters + item.meters;
              const status = revertedMeters >= roll.initialMeters ? 'available' : 'partially_sold';
              
              await updateDoc(doc(db, 'inventory', item.rollId), {
                currentMeters: revertedMeters,
                status,
                updatedAt: new Date().toISOString()
              });
            }
          }
        }

        // B. Preparamos el objeto modificado
        const updatedPL: PackingList = {
          ...editingPackingList,
          packingListNo: packingListNo.trim(),
          type: packingType,
          clientId,
          sellerId,
          date: docDate,
          items: finalItems,
          totalMeters: totalMetersValue,
          totalRollsOrCuts: totalRollsValue,
          notes: notes.trim(),
          guideNumber: guideNumber.trim(),
          dispatchAddress: dispatchAddress.trim(),
          signedBy: {
            ...editingPackingList.signedBy,
            date: docDate
          }
        };

        // C. Guardamos la actualización en Firebase
        await updateDoc(doc(db, 'packinglists', editingPackingList.id), updatedPL);

        // D. Aplicamos los nuevos despachos calculando el stock correcto basándonos en la reversión previa
        for (const item of finalItems) {
          if (item.rollId) {
            const roll = inventory.find(r => r.id === item.rollId);
            if (roll) {
              // Calculamos el metraje final: metraje actual + metraje anterior (si existía) - nuevo metraje despachado
              const oldItem = editingPackingList.items.find(oi => oi.rollId === item.rollId && oi.articleId === item.articleId);
              const oldMeters = oldItem ? oldItem.meters : 0;
              const nextMeters = Math.max(0, roll.currentMeters + oldMeters - item.meters);
              const status = nextMeters === 0 ? 'sold' : 'available';

              await updateDoc(doc(db, 'inventory', item.rollId), {
                currentMeters: nextMeters,
                status,
                updatedAt: new Date().toISOString()
              });
            }
          }
        }

        await onRefresh();
        setIsSuccessfullySaved(true);
        setSuccess(`¡Packing List ${updatedPL.packingListNo} modificado correctamente!`);
        localStorage.removeItem("texflow_draft_packinglist");
        
        // Cargamos vista de impresión/PDF inmediatamente
        onPackingListCreated(updatedPL);

      } else {
        // --- 2. REGISTRAR NUEVO PACKING LIST (O DUPLICADO) ---
        
        const newPL: PackingList = {
          id: `pl-${Date.now()}`,
          packingListNo: packingListNo.trim(),
          type: packingType,
          clientId,
          sellerId,
          date: docDate,
          items: finalItems,
          totalMeters: totalMetersValue,
          totalRollsOrCuts: totalRollsValue,
          notes: notes.trim(),
          guideNumber: guideNumber.trim(),
          dispatchAddress: dispatchAddress.trim(),
          importantNotice: "Revisar el rollo antes de cortar y conservar la etiqueta.",
          signedBy: {
            name: "",
            dni: "",
            date: docDate,
            signaturePresent: true
          },
          createdAt: new Date().toISOString(),
          appVersion: '2.6r'
        };

        // Guardar nuevo registro
        await addDoc(collection(db, 'packinglists'), newPL);

        // Descontar del stock de almacén
        for (const item of finalItems) {
          if (item.rollId) {
            const roll = inventory.find(r => r.id === item.rollId);
            if (roll) {
              const nextMeters = Math.max(0, roll.currentMeters - item.meters);
              const status = nextMeters === 0 ? 'sold' : 'available';

              await updateDoc(doc(db, 'inventory', item.rollId), {
                currentMeters: nextMeters,
                status,
                updatedAt: new Date().toISOString()
              });
            }
          }
        }

        await onRefresh();
        setIsSuccessfullySaved(true);
        setSuccess(`¡Packing List ${newPL.packingListNo} registrado correctamente!`);
        localStorage.removeItem("texflow_draft_packinglist");
        
        // Cargamos vista de impresión/PDF inmediatamente
        onPackingListCreated(newPL);
      }

      // Resetear estado del formulario
      resetFormState();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al guardar el Packing List');
    } finally {
      setLoading(false);
    }
  };

  // Global Keyboard Shortcuts (Ctrl+Enter to Save, Escape to close draft prompt modal)
  useEffect(() => {
    const handleFormKeyDown = (e: KeyboardEvent) => {
      const isEnter = e.key === 'Enter';
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isEnter && isCtrlOrMeta) {
        e.preventDefault();
        handleSubmit();
      }

      if (e.key === 'Escape') {
        if (showRecoveryPrompt) {
          e.preventDefault();
          handleDiscardDraft();
        }
      }
    };

    window.addEventListener('keydown', handleFormKeyDown);
    return () => window.removeEventListener('keydown', handleFormKeyDown);
  }, [handleSubmit, showRecoveryPrompt]);

  return (
    <div className="ticket-perforated p-6 shadow-xs">
      {showRecoveryPrompt && (
        <div className="fixed inset-0 bg-app-bg/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-app-surface border border-app-border rounded-lg w-full max-w-md shadow-xl overflow-hidden animate-slide-up text-app-text">
            
            {/* Header */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-950/40 p-5 flex items-center gap-3">
              <div className="bg-amber-500 text-white p-2 rounded">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">Borrador Detectado</h4>
                <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-0.5">DESPACHO SIN GUARDAR</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-xs font-medium leading-relaxed text-app-text/80">
                Se encontró un despacho sin guardar de una sesión anterior. ¿Deseas recuperar este borrador para continuar trabajando en él?
              </p>
              
              <div className="bg-app-bg border border-app-border rounded p-3 text-[10px] space-y-1 text-app-text/70">
                <div>• <strong>Cliente:</strong> {clients.find(c => c.id === draftData?.clientId)?.name || 'No especificado'}</div>
                <div>• <strong>Artículos:</strong> {draftData?.articleGroups?.length || 0} sección(es) de tela</div>
                <div>• <strong>Rollos/Cortes:</strong> {draftData?.articleGroups?.reduce((acc: number, g: any) => acc + (g.rolls?.length || 0), 0) || 0} unidades</div>
                {draftData?.notes && (
                  <div className="truncate">• <strong>Notas:</strong> {draftData.notes}</div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-app-bg px-6 py-4 border-t border-app-border flex justify-end gap-3 shrink-0">
              <button
                onClick={handleDiscardDraft}
                className="px-3 py-1.5 hover:bg-red-50 hover:text-red-600 border border-app-border rounded text-xs font-bold transition cursor-pointer"
              >
                Descartar
              </button>
              <button
                onClick={handleRecoverDraft}
                className="px-3 py-1.5 bg-app-primary hover:bg-app-primary/90 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                Recuperar Despacho
              </button>
            </div>

          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-start md:items-center gap-4 border-b border-app-border pb-4 mb-6">
        <div>
          <h2 className="text-sm font-bold text-app-text flex items-center gap-2">
            <ShoppingBag 
              className={
                editingPackingList && !isDuplicate 
                  ? 'text-app-primary' 
                  : isDuplicate 
                    ? 'text-app-text/90' 
                    : 'text-app-secondary'
              } 
              size={18} 
            />
            {editingPackingList && !isDuplicate ? (
              <span>Modificar Packing List <span className="font-mono text-app-primary">{editingPackingList.packingListNo}</span></span>
            ) : isDuplicate ? (
              <span>Duplicar Packing List <span className="font-mono text-app-text/90">{editingPackingList?.packingListNo}</span></span>
            ) : (
              'Generar Nuevo Packing List'
            )}
          </h2>
          <p className="text-[11px] text-app-text/50 mt-1">
            {editingPackingList && !isDuplicate 
              ? 'Realice cambios en los metrajes, datos del cliente u operarios. El inventario se recalculará automáticamente.' 
              : isDuplicate 
                ? 'Cree un nuevo packing list a partir del contenido del documento original.'
                : 'Registre despachos ingresando múltiples cantidades de metraje en uno o varios artículos.'}
          </p>
        </div>

        {/* Toggle between Nuevo, Antiguo, or Corte */}
        <div className="flex bg-app-bg p-1 rounded-lg border border-app-border gap-1 flex-wrap w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setPackingType('nuevo');
              setArticleGroups(prev => prev.map(g => ({
                ...g,
                rolls: g.rolls.map((r, rIdx) => ({
                  ...r,
                  rollNumber: r.rollNumber.startsWith('CORTE-') ? `ROLLO-${rIdx + 1}` : r.rollNumber
                }))
              })));
            }}
            className={`px-3 py-2.5 md:py-1 rounded-md text-xs font-semibold transition cursor-pointer min-h-[40px] md:min-h-0 flex-1 sm:flex-none text-center flex items-center justify-center ${
              packingType === 'nuevo'
                ? 'bg-app-primary text-white shadow-xs'
                : 'text-app-text/60 hover:text-app-text hover:bg-app-bg'
            }`}
            id="toggle-type-nuevo"
          >
            P. List Nuevo
          </button>
          <button
            type="button"
            onClick={() => {
              setPackingType('antiguo');
              setArticleGroups(prev => prev.map(g => ({
                ...g,
                source: 'custom',
                rolls: g.rolls.map((r, rIdx) => ({
                  ...r,
                  rollId: undefined,
                  rollNumber: r.rollNumber.startsWith('ROLLO-') ? `CORTE-${rIdx + 1}` : r.rollNumber
                }))
              })));
            }}
            className={`px-3 py-2.5 md:py-1 rounded-md text-xs font-semibold transition cursor-pointer min-h-[40px] md:min-h-0 flex-1 sm:flex-none text-center flex items-center justify-center ${
              packingType === 'antiguo'
                ? 'bg-app-primary text-white shadow-xs'
                : 'text-app-text/60 hover:text-app-text hover:bg-app-bg'
            }`}
            id="toggle-type-antiguo"
          >
            P. List Antiguo
          </button>
          <button
            type="button"
            onClick={() => {
              setPackingType('corte');
              setArticleGroups(prev => prev.map(g => ({
                ...g,
                source: 'custom',
                rolls: g.rolls.map((r, rIdx) => ({
                  ...r,
                  rollId: undefined,
                  rollNumber: r.rollNumber.startsWith('ROLLO-') ? `CORTE-${rIdx + 1}` : r.rollNumber
                }))
              })));
            }}
            className={`px-3 py-2.5 md:py-1 rounded-md text-xs font-semibold transition cursor-pointer min-h-[40px] md:min-h-0 flex-1 sm:flex-none text-center flex items-center justify-center ${
              packingType === 'corte'
                ? 'bg-app-primary text-white shadow-xs'
                : 'text-app-text/60 hover:text-app-text hover:bg-app-bg'
            }`}
            id="toggle-type-corte"
          >
            P. List Corte
          </button>
        </div>
      </div>

      {editingPackingList && (
        <AlertBanner
          type="info"
          message={
            <div className="flex items-center justify-between gap-3 w-full flex-wrap sm:flex-nowrap">
              <span className="font-medium">
                {isDuplicate ? (
                  <>
                    Duplicando Packing List N° <strong className="font-mono">{editingPackingList.packingListNo}</strong> — se generará un número nuevo al guardar.
                  </>
                ) : (
                  <>
                    Editando Packing List N° <strong className="font-mono">{editingPackingList.packingListNo}</strong>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-2.5 py-1 bg-app-info/20 hover:bg-app-info/30 text-app-info border border-app-info/40 rounded text-xs font-bold transition cursor-pointer shrink-0 ml-auto"
                id="btn-cancel-editing-mode"
              >
                Cancelar Edición
              </button>
            </div>
          }
          className="mb-4"
          id="alert-pl-editing-mode"
        />
      )}

      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
          className="mb-4"
          id="alert-pl-error"
        />
      )}

      {success && (
        <AlertBanner
          type="success"
          message={success}
          onClose={() => setSuccess(null)}
          className="mb-4"
          id="alert-pl-success"
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECCIÓN 1: DATOS DEL DESPACHO */}
        <div className="p-5 border border-app-border rounded-xl bg-app-bg/30 space-y-4">
          <div className="flex items-center gap-2 pb-2.5 border-b border-app-border">
            <div className="p-1.5 rounded-md bg-app-primary/10 text-app-primary">
              <FileText size={18} />
            </div>
            <h3 className="text-xs font-bold text-app-text uppercase tracking-wider">
              1. Datos del Despacho
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-bold text-app-text/80 mb-1">Nº de Packing List *</label>
              <input
                type="text"
                required
                value={packingListNo}
                onChange={e => setPackingListNo(e.target.value)}
                placeholder="Ej. PL-00234"
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm font-mono font-bold text-app-text focus:ring-2 focus:ring-app-primary bg-app-surface"
                id="input-pl-no"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-app-text/80 mb-1">Fecha de Despacho *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-app-text/45" size={16} />
                <input
                  type="date"
                  required
                  value={docDate}
                  onChange={e => setDocDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-app-border rounded-lg text-sm focus:ring-2 focus:ring-app-primary bg-app-surface text-app-text"
                />
              </div>
            </div>

            <ClientSellerSelector
              clientId={clientId}
              setClientId={handleClientChange}
              clients={clients}
              onAddNewClient={handleAddNewClient}
              sellerId={sellerId}
              setSellerId={setSellerId}
              sellers={sellers}
              onAddNewSeller={handleAddNewSeller}
              formProviderId={formProviderId}
              setFormProviderId={setFormProviderId}
              providers={providers}
              onAddNewProvider={handleAddNewProvider}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-app-border/40">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-app-text/80 mb-1">Número de Guía</label>
              <input
                type="text"
                value={guideNumber}
                onChange={e => setGuideNumber(e.target.value)}
                placeholder="Ej. G001-000234 (Opcional)"
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text focus:ring-2 focus:ring-app-primary bg-app-surface font-mono"
                id="input-pl-guide"
              />
              <p className="text-[11px] text-app-text/50 mt-1 leading-snug">
                Opcional. Puedes completarlo después si aún no tienes el número.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-app-text/80 mb-1">Dirección de Despacho</label>
              <input
                type="text"
                value={dispatchAddress}
                onChange={e => setDispatchAddress(e.target.value)}
                placeholder="Dirección donde se entregará la mercadería (Sugerida del Cliente, Editable)"
                className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text focus:ring-2 focus:ring-app-primary bg-app-surface"
                id="input-pl-dispatch-address"
              />
              <p className="text-[11px] text-app-text/50 mt-1 leading-snug">
                Se autocompleta con la dirección del cliente, pero puedes editarla para este despacho en particular.
              </p>
            </div>
          </div>
        </div>

        {/* Divisor Visual Sutil */}
        <hr className="border-app-border/60 my-6" />

        {/* SECCIÓN 2: ARTÍCULOS Y ROLLOS */}
        <div className="p-5 border border-app-border rounded-xl bg-app-bg/30 space-y-4">
          <div className="flex flex-wrap justify-between items-center pb-2.5 border-b border-app-border gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-app-primary/10 text-app-primary">
                <Layers size={18} />
              </div>
              <h3 className="text-xs font-bold text-app-text uppercase tracking-wider">
                2. Artículos y Rollos
              </h3>
            </div>
            <button
              type="button"
              onClick={handleAddArticleGroup}
              className="px-4 py-2.5 md:py-1.5 bg-app-primary hover:bg-app-primary/90 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs min-h-[40px] md:min-h-0 w-full sm:w-auto"
              id="btn-add-article-section"
            >
              <Plus size={14} />
              Añadir Otro Artículo
            </button>
          </div>

          <div className="space-y-6">
            {articleGroups.map((group, index) => (
              <ArticleGroupSection
                key={group.id}
                group={group}
                index={index}
                articles={articles}
                providers={providers}
                packingType={packingType}
                availableRolls={availableRolls}
                allInventory={inventory}
                packingLists={packingLists}
                formProviderId={formProviderId}
                onRemove={handleRemoveArticleGroup}
                onGroupFieldChange={handleGroupFieldChange}
                onRollFieldChange={handleRollFieldChange}
                onAddRoll={handleAddRollToGroup}
                onRemoveRoll={handleRemoveRollFromGroup}
                onProcessUnifiedInput={handleProcessUnifiedInput}
                onRollKeyDown={handleRollKeyDown}
                onAddNewArticle={handleAddNewArticle}
                onAddScannedRoll={handleAddScannedRollToGroup}
              />
            ))}
          </div>
        </div>

        {/* SECCIÓN 3: NOTAS ADICIONALES (Solo en Packing List de Corte) */}
        {packingType === 'corte' && (
          <>
            <hr className="border-app-border/60 my-6" />
            <div className="p-5 border border-app-border rounded-xl bg-app-bg/30 space-y-4">
              <div className="flex items-center gap-2 pb-2.5 border-b border-app-border">
                <div className="p-1.5 rounded-md bg-app-primary/10 text-app-primary">
                  <FileText size={18} />
                </div>
                <h3 className="text-xs font-bold text-app-text uppercase tracking-wider">
                  3. Notas Adicionales
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold text-app-text/80 mb-1">
                  Notas / Observaciones (Se imprimirá en el Packing List)
                </label>
                <textarea
                  placeholder="Escriba alguna nota, observación o instrucción especial para este packing list..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm bg-app-surface focus:ring-2 focus:ring-app-primary placeholder:text-app-text/45 text-app-text"
                  id="input-pl-notes"
                />
              </div>
            </div>
          </>
        )}

        {/* Submit Actions - Floating Sticky Bar */}
        <div className="sticky bottom-0 z-20 bg-app-surface border-t border-app-border p-4 -mx-6 -mb-6 mt-6 shadow-lg flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 rounded-b-xl">
          <span className="text-[10px] text-app-text/45 font-semibold font-mono no-print text-center sm:text-left sm:mr-auto">
            Atajo: <span className="bg-app-bg border border-app-border rounded px-1.5 py-0.5 font-bold">Ctrl + Enter</span> para guardar
          </span>
          {editingPackingList && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-4 py-3 sm:py-2.5 bg-app-bg hover:bg-app-border text-app-text font-bold rounded-lg text-sm transition cursor-pointer border border-app-border min-h-[44px] sm:min-h-0 flex items-center justify-center"
            >
              Cancelar {isDuplicate ? 'Duplicación' : 'Modificación'}
            </button>
          )}
          <button
            type="button"
            disabled={!hasContent && !editingPackingList && !isDuplicate}
            onClick={() => setIsResetConfirmOpen(true)}
            className={`px-4 py-3 sm:py-2.5 border rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0 ${
              (hasContent || editingPackingList || isDuplicate)
                ? 'bg-red-50 dark:bg-red-950/10 hover:bg-red-100 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30 cursor-pointer'
                : 'bg-app-surface/50 border-app-border text-app-text/30 cursor-not-allowed opacity-50'
            }`}
            id="btn-clear-packinglist"
            title="Borrar todos los datos ingresados en el formulario"
          >
            <Trash2 size={16} />
            Borrar Todo
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-3.5 sm:py-3 text-white font-bold rounded-lg text-sm transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 min-h-[44px] ${
              editingPackingList && !isDuplicate
                ? 'bg-app-primary hover:bg-app-primary/90'
                : isDuplicate
                  ? 'bg-app-secondary hover:bg-app-secondary/90'
                  : 'bg-app-secondary hover:bg-app-secondary/90'
            }`}
            id="btn-submit-packinglist"
          >
            {loading 
              ? (editingPackingList && !isDuplicate ? 'Guardando cambios...' : isDuplicate ? 'Duplicando...' : 'Generando Packing List...') 
              : (editingPackingList && !isDuplicate ? 'Guardar Cambios' : isDuplicate ? 'Crear Duplicado' : 'Generar Packing List e Imprimir')}
            <ChevronRight size={16} />
          </button>
        </div>
      </form>

      {/* Custom Form Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 bg-app-bg/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-app-surface border border-app-border rounded w-full max-w-md shadow-xl overflow-hidden animate-slide-up text-app-text">
            
            {/* Header */}
            <div className="bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-950/40 p-5 flex items-center gap-3">
              <div className="bg-red-500 text-white p-2 rounded">
                <Trash2 size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider">BORRAR TODO / CANCELAR</h4>
                <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mt-0.5">LIMPIEZA DE FORMULARIO</p>
              </div>
              <button 
                onClick={() => setIsResetConfirmOpen(false)} 
                className="ml-auto text-app-text/45 hover:text-app-text cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                <p className="text-xs font-medium leading-relaxed text-app-text/80">
                  ¿Seguro que deseas borrar todos los datos ingresados en este formulario? Esta acción no se puede deshacer.
                </p>
                
                {(editingPackingList || isDuplicate) && (
                  <div className="bg-amber-50 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-900/30 rounded p-3 text-[10px] text-amber-900 dark:text-amber-400 font-medium">
                    ⚠️ Se cancelará el modo de <strong>{isDuplicate ? 'duplicación' : 'edición'}</strong> actual y volverás al formulario vacío de nuevo ingreso.
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-app-bg px-6 py-4 border-t border-app-border flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-3 py-1.5 hover:bg-app-border text-app-text/75 hover:text-app-text border border-app-border rounded text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer uppercase tracking-wider"
              >
                <Trash2 size={12} />
                Sí, Borrar Todo
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
