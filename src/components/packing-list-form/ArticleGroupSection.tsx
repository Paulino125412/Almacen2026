import React, { useState } from 'react';
import { Plus, Trash2, QrCode } from 'lucide-react';
import { Article, Provider, RollItem, PackingList } from '../../types';
import { FormArticleGroup, FormRollEntry } from './types';
import ExcelPasteParser from './ExcelPasteParser';
import SearchableCombobox from '../SearchableCombobox';
import BarcodeScannerModal from '../BarcodeScannerModal';

interface ArticleGroupSectionProps {
  key?: React.Key;
  group: FormArticleGroup;
  index: number;
  articles: Article[];
  providers: Provider[];
  packingType: 'nuevo' | 'antiguo' | 'corte' | 'rollo';
  availableRolls: RollItem[];
  allInventory: RollItem[];
  packingLists: PackingList[];
  formProviderId: string;
  onRemove: (groupId: string) => void;
  onGroupFieldChange: (groupId: string, field: keyof FormArticleGroup, value: any) => void;
  onRollFieldChange: (groupId: string, rollId: string, field: keyof FormRollEntry, value: any) => void;
  onAddRoll: (groupId: string) => void;
  onRemoveRoll: (groupId: string, rollId: string) => void;
  onProcessUnifiedInput: (groupId: string, textToProcess: string) => void;
  onRollKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, groupId: string, rollIndex: number) => void;
  onAddNewArticle: (name: string, fields: Record<string, string>) => Promise<string>;
  onAddScannedRoll: (groupId: string, scan: {
    rollNumber: string;
    meters?: number;
    lot?: string;
    partida?: string;
    tono?: string;
    width?: string;
    weight?: string;
    rollId?: string;
    maxMeters?: number;
  }) => void;
}

export default function ArticleGroupSection({
  group,
  index,
  articles,
  providers,
  packingType,
  availableRolls,
  allInventory,
  packingLists,
  formProviderId,
  onRemove,
  onGroupFieldChange,
  onRollFieldChange,
  onAddRoll,
  onRemoveRoll,
  onProcessUnifiedInput,
  onRollKeyDown,
  onAddNewArticle,
  onAddScannedRoll
}: ArticleGroupSectionProps) {
  const groupEffectiveProviderId = group.providerId || formProviderId;
  const pConfig = providers.find(p => p.id === groupEffectiveProviderId) || null;
  const isExcelOnly = pConfig && (pConfig.hasRollNo ?? true) && pConfig.hasWidth && pConfig.hasWeight;
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const currentArticleObj = articles.find(a => a.id === group.articleId || a.name === group.articleId);
  const effectiveArticleId = currentArticleObj ? currentArticleObj.id : group.articleId;

  const articleOptions = articles
    .filter(a => 
      !groupEffectiveProviderId || 
      a.providerId === groupEffectiveProviderId || 
      a.id === effectiveArticleId || 
      a.id === group.articleId || 
      a.name === group.articleId
    )
    .map(a => {
      const provName = providers.find(p => p.id === a.providerId)?.name || '';
      return {
        id: a.id,
        name: a.name,
        detail: provName
      };
    });

  if (group.articleId && !articleOptions.some(o => o.id === group.articleId || o.id === effectiveArticleId || o.name === group.articleId)) {
    articleOptions.unshift({
      id: group.articleId,
      name: currentArticleObj ? currentArticleObj.name : group.articleId,
      detail: ''
    });
  }

  const showLot = Boolean((pConfig?.hasLot) || group.rolls.some(r => !!r.lot) || group.source === 'custom');
  const showPartida = Boolean((pConfig?.hasPartida) || group.rolls.some(r => !!r.partida) || group.source === 'custom');
  const showTono = Boolean((pConfig?.hasTono) || group.rolls.some(r => !!r.tono) || group.source === 'custom');
  const showWidth = Boolean((pConfig?.hasWidth) || group.rolls.some(r => !!r.width) || group.source === 'custom');
  const showWeight = Boolean((pConfig?.hasWeight) || group.rolls.some(r => !!r.weight) || group.source === 'custom');
  const showExtraRowFields = showLot || showPartida || showTono || showWidth || showWeight;

  const handleOpenScanner = () => {
    if (!group.articleId) {
      alert("Debe seleccionar un Artículo (Tela) primero antes de activar el escáner de la cámara.");
      return;
    }
    setIsScannerOpen(true);
  };

  return (
    <div className="p-4 sm:p-5 border-2 border-app-border hover:border-app-border/80 rounded-xl bg-app-surface shadow-xs space-y-4 relative group">
      
      {/* Absolute remove article section button */}
      <button
        type="button"
        onClick={() => onRemove(group.id)}
        className="absolute top-3.5 right-3.5 text-app-text/45 hover:text-red-500 p-2 md:p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center bg-app-surface/80 border border-app-border md:border-none"
        title="Eliminar esta sección de artículo completa"
      >
        <Trash2 size={18} />
      </button>

      {/* Section Header */}
      <div className="flex flex-wrap items-center gap-3 pr-10">
        <span className="w-6 h-6 rounded-full bg-app-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
          {index + 1}
        </span>
        <h4 className="text-xs font-black text-app-text uppercase tracking-widest mr-2">
          SECCIÓN DE ARTÍCULO
        </h4>

        {/* Stock Pick vs Direct Entry */}
        {(packingType === 'nuevo' || packingType === 'rollo') && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex bg-app-bg p-1 rounded-lg border border-app-border text-xs md:text-[10px] font-bold w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onGroupFieldChange(group.id, 'source', 'inventory')}
                className={`px-3 py-2 md:px-2 md:py-0.5 rounded-md cursor-pointer transition min-h-[38px] md:min-h-0 flex-1 sm:flex-none text-center flex items-center justify-center ${group.source === 'inventory' ? 'bg-app-surface text-app-text shadow-xs' : 'text-app-text/50'}`}
              >
                Pick de Almacén (Stock)
              </button>
              <button
                type="button"
                onClick={() => onGroupFieldChange(group.id, 'source', 'custom')}
                className={`px-3 py-2 md:px-2 md:py-0.5 rounded-md cursor-pointer transition min-h-[38px] md:min-h-0 flex-1 sm:flex-none text-center flex items-center justify-center ${group.source === 'custom' ? 'bg-app-surface text-app-text shadow-xs' : 'text-app-text/50'}`}
              >
                Ingreso Directo
              </button>
            </div>
            <p className="text-[11px] text-app-text/50 font-normal">
              Inventario: elige un rollo ya registrado. Manual: ingresa los datos libremente.
            </p>
          </div>
        )}
      </div>

      {/* Article and Provider selection fields */}
      <div className="grid grid-cols-1 gap-4">
        {group.source === 'custom' ? (
          <div>
            <SearchableCombobox
              label="Artículo (Tela) *"
              placeholder="Buscar o registrar Artículo..."
              value={effectiveArticleId || group.articleId}
              onChange={val => onGroupFieldChange(group.id, 'articleId', val)}
              options={articleOptions}
              addNewText="Registrar como Nuevo Artículo (Tela)"
              onAddNewWithFields={onAddNewArticle}
              additionalFields={[
                { key: 'description', label: 'Descripción', placeholder: 'Ingrese descripción (Opcional)' }
              ]}
            />
          </div>
        ) : (
          <div>
            <SearchableCombobox
              label="Artículo del Despacho (Pick de Almacén) *"
              placeholder="Buscar Artículo en Almacén..."
              value={effectiveArticleId || group.articleId}
              onChange={val => {
                const selectedArt = articles.find(a => a.id === val || a.name === val);
                if (selectedArt) {
                  onGroupFieldChange(group.id, 'providerId', selectedArt.providerId);
                  onGroupFieldChange(group.id, 'articleId', selectedArt.id);
                } else {
                  onGroupFieldChange(group.id, 'articleId', val);
                }
              }}
              options={articleOptions}
            />
          </div>
        )}
      </div>

      {/* Dynamic fields (Lote, Partida, Tono) depending on Custom config */}
      {(packingType === 'nuevo' || packingType === 'rollo') && group.source === 'custom' && pConfig && (pConfig.hasLot || pConfig.hasPartida || pConfig.hasTono) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-app-bg p-3 rounded-lg border border-app-border">
          {pConfig.hasLot && (
            <div>
              <label className="block text-xs md:text-[10px] font-bold text-app-text/80 mb-1 uppercase">
                Lote (Compartido)
              </label>
              <input
                type="text"
                placeholder="Ingrese Lote para el grupo"
                value={group.lot}
                onChange={e => onGroupFieldChange(group.id, 'lot', e.target.value)}
                className="w-full px-3 py-2 md:py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text min-h-[40px] md:min-h-0"
              />
            </div>
          )}
          {pConfig.hasPartida && (
            <div>
              <label className="block text-xs md:text-[10px] font-bold text-app-text/80 mb-1 uppercase">
                Partida (Compartida)
              </label>
              <input
                type="text"
                placeholder="Ingrese Partida para el grupo"
                value={group.partida}
                onChange={e => onGroupFieldChange(group.id, 'partida', e.target.value)}
                className="w-full px-3 py-2 md:py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text min-h-[40px] md:min-h-0"
              />
            </div>
          )}
          {pConfig.hasTono && (
            <div>
              <label className="block text-xs md:text-[10px] font-bold text-app-text/80 mb-1 uppercase">
                Tono / Color (Compartido)
              </label>
              <input
                type="text"
                placeholder="Ingrese Tono para el grupo"
                value={group.tono}
                onChange={e => onGroupFieldChange(group.id, 'tono', e.target.value)}
                className="w-full px-3 py-2 md:py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text min-h-[40px] md:min-h-0"
              />
            </div>
          )}
        </div>
      )}

      {/* Optional Lote and Partida for Packing List Antiguo */}
      {packingType === 'antiguo' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-app-bg p-3 rounded-lg border border-app-border">
          <div>
            <label className="block text-xs md:text-[10px] font-bold text-app-text/80 mb-1 uppercase">Lote (Opcional)</label>
            <input
              type="text"
              placeholder="Ingrese Lote"
              value={group.lot || ''}
              onChange={e => onGroupFieldChange(group.id, 'lot', e.target.value)}
              className="w-full px-3 py-2 md:py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary min-h-[40px] md:min-h-0"
            />
          </div>
          <div>
            <label className="block text-xs md:text-[10px] font-bold text-app-text/80 mb-1 uppercase">Partida (Opcional)</label>
            <input
              type="text"
              placeholder="Ingrese Partida"
              value={group.partida || ''}
              onChange={e => onGroupFieldChange(group.id, 'partida', e.target.value)}
              className="w-full px-3 py-2 md:py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary min-h-[40px] md:min-h-0"
            />
          </div>
        </div>
      )}

      {/* Embedded Roll Quantities list for this specific article */}
      <div className="space-y-4 bg-app-bg/40 p-3.5 sm:p-4 rounded-lg border-2 border-app-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <p className="text-xs md:text-[10px] font-black text-app-text/80 uppercase tracking-wider flex items-center gap-1">
            {packingType === 'corte' 
              ? `Cantidades de Corte para este Artículo (${group.rolls.length})`
              : `Cantidades de Metraje para este Artículo (${group.rolls.length})`}
          </p>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleOpenScanner}
              className="px-3 py-2 md:px-2.5 md:py-1 bg-app-secondary/10 hover:bg-app-secondary/20 dark:bg-app-secondary/20 dark:hover:bg-app-secondary/35 border border-app-secondary/30 dark:border-app-secondary/40 text-app-secondary rounded-lg text-xs md:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs min-h-[40px] md:min-h-0 flex-1 sm:flex-none"
              title="Escanear etiquetas de rollos con la cámara"
            >
              <QrCode size={14} className="text-app-secondary" />
              Escanear Cámara (QR/Barra)
            </button>

            {!isExcelOnly ? (
              <button
                type="button"
                onClick={() => onAddRoll(group.id)}
                className="px-3 py-2 md:px-2.5 md:py-1 bg-app-surface hover:bg-app-bg border border-app-border text-app-text rounded-lg text-xs md:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs min-h-[40px] md:min-h-0 flex-1 sm:flex-none"
              >
                <Plus size={14} />
                {packingType === 'corte' ? 'Añadir Corte Manual' : 'Añadir Fila Manual'}
              </button>
            ) : (
              <span className="text-xs md:text-[10px] font-extrabold text-app-primary bg-app-bg px-2.5 py-1.5 rounded border border-app-border text-center w-full sm:w-auto">
                Solo permitido Pegar desde Excel
              </span>
            )}
          </div>
        </div>

        {/* Quick-add field for custom entry */}
        {group.source === 'custom' && (
          <ExcelPasteParser
            groupId={group.id}
            pConfig={pConfig}
            isExcelOnly={!!isExcelOnly}
            packingType={packingType}
            onProcess={(text) => onProcessUnifiedInput(group.id, text)}
          />
        )}

        {/* List of items below */}
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {group.rolls.length === 0 ? (
            <p className="text-center py-4 text-xs italic text-app-text/50">
              No hay metrajes agregados. Escriba un metraje arriba para agregar.
            </p>
          ) : (
            group.rolls.map((roll, rIndex) => {
              return (
                <div key={roll.id} className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 bg-app-surface p-2.5 md:p-2 border border-app-border rounded-lg shadow-2xs text-app-text">
                  {/* Top line on mobile: Number label + Remove button */}
                  <div className="flex items-center justify-between md:justify-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-app-bg text-app-text/80 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {rIndex + 1}
                    </span>
                    <span className="text-[10px] font-bold text-app-text/50 uppercase md:hidden">
                      Fila #{rIndex + 1}
                    </span>
                  </div>

                  {/* Identification / selection */}
                  {(packingType === 'nuevo' || packingType === 'rollo') && (
                    <div className="flex-1">
                      {group.source === 'inventory' ? (
                        <select
                          required
                          value={roll.rollId || ''}
                          onChange={e => onRollFieldChange(group.id, roll.id, 'rollId', e.target.value)}
                          className="w-full px-2.5 py-2 md:py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface min-h-[40px] md:min-h-0"
                        >
                          <option value="">-- Seleccionar Rollo de Stock --</option>
                          {availableRolls
                            .filter(r => r.articleId === group.articleId)
                            .map(r => (
                              <option key={r.id} value={r.id}>
                                {r.rollNumber} [Stock: {r.currentMeters.toFixed(2)}m] {r.lot ? `| Lote: ${r.lot}` : ''}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <div className="relative">
                          <span className="absolute left-2.5 top-2.5 md:top-1.5 text-app-text/45 font-mono text-[9px] uppercase font-bold">Nº</span>
                          <input
                            type="text"
                            required
                            placeholder="Etiqueta / Nº de Rollo"
                            value={roll.rollNumber}
                            onChange={e => onRollFieldChange(group.id, roll.id, 'rollNumber', e.target.value)}
                            className="w-full pl-7 pr-2.5 py-2 md:py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface min-h-[40px] md:min-h-0"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Meters quantity */}
                  <div className={(packingType === 'corte' || packingType === 'antiguo') ? "w-full md:flex-1" : "w-full md:w-32"}>
                    <div className="relative">
                      <input
                        id={`meters-${group.id}-${rIndex}`}
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="Metros"
                        value={roll.meters || ''}
                        onChange={e => onRollFieldChange(group.id, roll.id, 'meters', Number(e.target.value))}
                        onKeyDown={e => onRollKeyDown(e, group.id, rIndex)}
                        onFocus={e => e.target.select()}
                        className="w-full pl-2.5 pr-7 py-2 md:py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-secondary bg-app-surface min-h-[40px] md:min-h-0"
                      />
                      <span className="absolute right-2.5 top-2.5 md:top-1 text-app-text/45 font-mono text-[10px]">m</span>
                    </div>
                    {roll.maxMeters && (
                      <p className="text-[9px] text-app-text/50 mt-0.5">
                        Máx: {roll.maxMeters.toFixed(2)}m
                      </p>
                    )}
                  </div>

                  {/* Group optional extra fields in a responsive grid on mobile */}
                  {showExtraRowFields && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:items-center gap-2 w-full md:w-auto">
                      {/* Optional Lote per roll */}
                      {showLot && (
                        <div className="w-full md:w-24 shrink-0">
                          <input
                            type="text"
                            placeholder="Lote"
                            value={roll.lot || ''}
                            onChange={e => onRollFieldChange(group.id, roll.id, 'lot', e.target.value)}
                            className="w-full px-2 py-2 md:py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center min-h-[40px] md:min-h-0"
                          />
                        </div>
                      )}

                      {/* Optional Partida per roll */}
                      {showPartida && (
                        <div className="w-full md:w-24 shrink-0">
                          <input
                            type="text"
                            placeholder="Partida"
                            value={roll.partida || ''}
                            onChange={e => onRollFieldChange(group.id, roll.id, 'partida', e.target.value)}
                            className="w-full px-2 py-2 md:py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center min-h-[40px] md:min-h-0"
                          />
                        </div>
                      )}

                      {/* Optional Tono per roll */}
                      {showTono && (
                        <div className="w-full md:w-24 shrink-0">
                          <input
                            type="text"
                            placeholder="Tono/Color"
                            value={roll.tono || ''}
                            onChange={e => onRollFieldChange(group.id, roll.id, 'tono', e.target.value)}
                            className="w-full px-2 py-2 md:py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center min-h-[40px] md:min-h-0"
                          />
                        </div>
                      )}

                      {/* Optional Ancho per roll */}
                      {showWidth && (
                        <div className="w-full md:w-24 shrink-0">
                          <input
                            type="text"
                            placeholder="Ancho"
                            value={roll.width || ''}
                            onChange={e => onRollFieldChange(group.id, roll.id, 'width', e.target.value)}
                            className="w-full px-2 py-2 md:py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center min-h-[40px] md:min-h-0"
                          />
                        </div>
                      )}

                      {/* Optional Peso per roll */}
                      {showWeight && (
                        <div className="w-full md:w-24 shrink-0">
                          <input
                            type="text"
                            placeholder="Peso"
                            value={roll.weight || ''}
                            onChange={e => onRollFieldChange(group.id, roll.id, 'weight', e.target.value)}
                            className="w-full px-2 py-2 md:py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center min-h-[40px] md:min-h-0"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delete roll button */}
                  <button
                    type="button"
                    onClick={() => onRemoveRoll(group.id, roll.id)}
                    className="text-red-500 md:text-app-text/45 hover:text-red-600 p-2 md:p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center self-end md:self-center bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 md:border-none shrink-0"
                    title="Eliminar este metraje"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanResult={(scan) => {
          const foundRoll = availableRolls.find(
            r => r.articleId === group.articleId &&
                 r.rollNumber.trim().toLowerCase() === scan.rollNumber.trim().toLowerCase()
          );
          if (foundRoll) {
            const emptyRoll = group.rolls.find(r => !r.rollId);
            if (emptyRoll) {
              onRollFieldChange(group.id, emptyRoll.id, 'rollId', foundRoll.id);
            } else {
              onAddScannedRoll(group.id, {
                rollNumber: foundRoll.rollNumber,
                rollId: foundRoll.id,
                meters: foundRoll.currentMeters,
                maxMeters: foundRoll.currentMeters,
                lot: foundRoll.lot,
                partida: foundRoll.partida,
                tono: foundRoll.tono,
                width: foundRoll.width,
                weight: foundRoll.weight
              });
            }
          } else {
            const depletedRoll = allInventory.find(
              r => r.articleId === group.articleId &&
                   r.rollNumber.trim().toLowerCase() === scan.rollNumber.trim().toLowerCase()
            );
            if (depletedRoll) {
              const usedPL = packingLists.find(pl =>
                pl.items.some(item => item.rollId === depletedRoll.id)
              );
              const packingListNo = usedPL ? usedPL.packingListNo : 'desconocido';
              const confirmed = window.confirm(
                `Este rollo (${depletedRoll.rollNumber}) ya fue registrado como agotado. Se usó en el Packing List N° ${packingListNo}. ¿Deseas continuar de todas formas y cargarlo como entrada manual?`
              );
              if (confirmed) {
                onAddScannedRoll(group.id, scan);
              }
            } else {
              onAddScannedRoll(group.id, scan);
            }
          }
        }}
      />
    </div>
  );
}
