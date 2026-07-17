import React, { useState } from 'react';
import { Plus, Trash2, QrCode } from 'lucide-react';
import { Article, Provider, RollItem } from '../../types';
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
    selectedRollId?: string;
  }) => void;
}

export default function ArticleGroupSection({
  group,
  index,
  articles,
  providers,
  packingType,
  availableRolls,
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
  const pConfig = providers.find(p => p.id === group.providerId) || null;
  const isExcelOnly = pConfig && (pConfig.hasRollNo ?? true) && pConfig.hasWidth && pConfig.hasWeight;
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleOpenScanner = () => {
    if (!group.articleId) {
      alert("Debe seleccionar un Artículo (Tela) primero antes de activar el escáner de la cámara.");
      return;
    }
    setIsScannerOpen(true);
  };

  return (
    <div className="p-5 border-2 border-app-border hover:border-app-border/80 rounded-xl bg-app-surface shadow-xs space-y-4 relative group">
      
      {/* Absolute remove article section button */}
      <button
        type="button"
        onClick={() => onRemove(group.id)}
        className="absolute top-4 right-4 text-app-text/45 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
        title="Eliminar esta sección de artículo completa"
      >
        <Trash2 size={18} />
      </button>

      {/* Section Header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-6 h-6 rounded-full bg-app-primary text-white flex items-center justify-center font-bold text-xs">
          {index + 1}
        </span>
        <h4 className="text-xs font-black text-app-text uppercase tracking-widest mr-2">
          SECCIÓN DE ARTÍCULO
        </h4>

        {/* Stock Pick vs Direct Entry */}
        {(packingType === 'nuevo' || packingType === 'rollo') && (
          <div className="flex bg-app-bg p-0.5 rounded border border-app-border text-[10px] font-bold">
            <button
              type="button"
              onClick={() => onGroupFieldChange(group.id, 'source', 'inventory')}
              className={`px-2 py-0.5 rounded cursor-pointer ${group.source === 'inventory' ? 'bg-app-surface text-app-text shadow-xs' : 'text-app-text/50'}`}
            >
              Pick de Almacén (Stock)
            </button>
            <button
              type="button"
              onClick={() => onGroupFieldChange(group.id, 'source', 'custom')}
              className={`px-2 py-0.5 rounded cursor-pointer ${group.source === 'custom' ? 'bg-app-surface text-app-text shadow-xs' : 'text-app-text/50'}`}
            >
              Ingreso Directo
            </button>
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
              value={group.articleId}
              onChange={val => onGroupFieldChange(group.id, 'articleId', val)}
              options={articles
                .filter(a => a.providerId === formProviderId)
                .map(a => ({ id: a.id, name: a.name }))}
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
              value={group.articleId}
              onChange={val => {
                const selectedArt = articles.find(a => a.id === val);
                if (selectedArt) {
                  onGroupFieldChange(group.id, 'providerId', selectedArt.providerId);
                  onGroupFieldChange(group.id, 'articleId', selectedArt.id);
                } else {
                  onGroupFieldChange(group.id, 'articleId', '');
                }
              }}
              options={articles
                .filter(a => a.providerId === formProviderId)
                .map(a => {
                  const provName = providers.find(p => p.id === a.providerId)?.name || '';
                  return {
                    id: a.id,
                    name: a.name,
                    detail: provName
                  };
                })}
            />
          </div>
        )}
      </div>

      {/* Dynamic fields (Lote, Partida, Tono) depending on Custom config */}
      {(packingType === 'nuevo' || packingType === 'rollo') && group.source === 'custom' && pConfig && (pConfig.hasLot || pConfig.hasPartida || pConfig.hasTono) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-app-bg p-3 rounded-lg border border-app-border">
          {pConfig.hasLot && (
            <div>
              <label className="block text-[10px] font-bold text-app-text/80 mb-1 uppercase">
                Lote {!group.hasProcessedExcel && '*'}
              </label>
              <input
                type="text"
                required={!group.hasProcessedExcel}
                disabled={group.hasProcessedExcel}
                placeholder={group.hasProcessedExcel ? "Cargado en lista" : "Ingrese Lote"}
                value={group.lot}
                onChange={e => onGroupFieldChange(group.id, 'lot', e.target.value)}
                className="w-full px-3 py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text disabled:bg-app-bg disabled:text-app-text/40 disabled:cursor-not-allowed"
              />
            </div>
          )}
          {pConfig.hasPartida && (
            <div>
              <label className="block text-[10px] font-bold text-app-text/80 mb-1 uppercase">
                Partida {!group.hasProcessedExcel && '*'}
              </label>
              <input
                type="text"
                required={!group.hasProcessedExcel}
                disabled={group.hasProcessedExcel}
                placeholder={group.hasProcessedExcel ? "Cargado en lista" : "Ingrese Partida"}
                value={group.partida}
                onChange={e => onGroupFieldChange(group.id, 'partida', e.target.value)}
                className="w-full px-3 py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text disabled:bg-app-bg disabled:text-app-text/40 disabled:cursor-not-allowed"
              />
            </div>
          )}
          {pConfig.hasTono && (
            <div>
              <label className="block text-[10px] font-bold text-app-text/80 mb-1 uppercase">
                Tono / Color {!group.hasProcessedExcel && '*'}
              </label>
              <input
                type="text"
                required={!group.hasProcessedExcel}
                disabled={group.hasProcessedExcel}
                placeholder={group.hasProcessedExcel ? "Cargado en lista" : "Ingrese Tono"}
                value={group.tono}
                onChange={e => onGroupFieldChange(group.id, 'tono', e.target.value)}
                className="w-full px-3 py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text disabled:bg-app-bg disabled:text-app-text/40 disabled:cursor-not-allowed"
              />
            </div>
          )}
        </div>
      )}

      {/* Optional Lote and Partida for Packing List Antiguo */}
      {packingType === 'antiguo' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-app-bg p-3 rounded-lg border border-app-border">
          <div>
            <label className="block text-[10px] font-bold text-app-text/80 mb-1 uppercase">Lote (Opcional)</label>
            <input
              type="text"
              placeholder="Ingrese Lote"
              value={group.lot || ''}
              onChange={e => onGroupFieldChange(group.id, 'lot', e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-app-text/80 mb-1 uppercase">Partida (Opcional)</label>
            <input
              type="text"
              placeholder="Ingrese Partida"
              value={group.partida || ''}
              onChange={e => onGroupFieldChange(group.id, 'partida', e.target.value)}
              className="w-full px-3 py-1.5 border border-app-border rounded-lg text-xs font-mono bg-app-surface text-app-text focus:ring-1 focus:ring-app-primary"
            />
          </div>
        </div>
      )}

      {/* Embedded Roll Quantities list for this specific article */}
      <div className="space-y-4 bg-app-bg/40 p-4 rounded-lg border-2 border-app-border">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <p className="text-[10px] font-black text-app-text/80 uppercase tracking-wider flex items-center gap-1">
            {packingType === 'corte' 
              ? `Cantidades de Corte para este Artículo (${group.rolls.length})`
              : `Cantidades de Metraje para este Artículo (${group.rolls.length})`}
          </p>
          {!isExcelOnly ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenScanner}
                className="px-2.5 py-1 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950 dark:border-green-800 dark:text-green-300 border border-green-200 text-green-700 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Escanear etiquetas de rollos con la cámara"
              >
                <QrCode size={11} className="text-green-600 dark:text-green-400" />
                Escanear Cámara (QR/Barra)
              </button>

              <button
                type="button"
                onClick={() => onAddRoll(group.id)}
                className="px-2.5 py-1 bg-app-surface hover:bg-app-bg border border-app-border text-app-text rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer shadow-2xs"
              >
                <Plus size={10} />
                {packingType === 'corte' ? 'Añadir Corte Manual' : 'Añadir Fila Manual'}
              </button>
            </div>
          ) : (
            <span className="text-[10px] font-extrabold text-app-primary bg-app-bg px-2.5 py-1 rounded border border-app-border">
              Solo permitido Pegar desde Excel
            </span>
          )}
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
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {group.rolls.length === 0 ? (
            <p className="text-center py-4 text-xs italic text-app-text/50">
              No hay metrajes agregados. Escriba un metraje arriba para agregar.
            </p>
          ) : (
            group.rolls.map((roll, rIndex) => {
              return (
                <div key={roll.id} className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-app-surface p-2 border border-app-border rounded-lg shadow-2xs text-app-text">
                  {/* Number label */}
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-app-bg text-app-text/80 flex items-center justify-center font-bold text-[10px]">
                      {rIndex + 1}
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
                          className="w-full px-2.5 py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface"
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
                          <span className="absolute left-2 top-1.5 text-app-text/45 font-mono text-[9px] uppercase font-bold">Nº</span>
                          <input
                            type="text"
                            required
                            placeholder="Etiqueta / Nº de Rollo"
                            value={roll.rollNumber}
                            onChange={e => onRollFieldChange(group.id, roll.id, 'rollNumber', e.target.value)}
                            className="w-full pl-6 pr-2 py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Meters quantity */}
                  <div className={(packingType === 'corte' || packingType === 'antiguo') ? "flex-1" : "w-32"}>
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
                        className="w-full pl-2.5 pr-6 py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-secondary bg-app-surface"
                      />
                      <span className="absolute right-2 top-1 text-app-text/45 font-mono text-[10px]">m</span>
                    </div>
                    {roll.maxMeters && (
                      <p className="text-[9px] text-app-text/50 mt-0.5">
                        Máx: {roll.maxMeters.toFixed(2)}m
                      </p>
                    )}
                  </div>

                  {/* Optional Lote per roll if provider config hasLot is active */}
                  {pConfig && pConfig.hasLot && group.source === 'custom' && (
                    <div className="w-24 shrink-0">
                      <input
                        type="text"
                        placeholder="Lote"
                        value={roll.lot || ''}
                        onChange={e => onRollFieldChange(group.id, roll.id, 'lot', e.target.value)}
                        className="w-full px-2 py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center"
                      />
                    </div>
                  )}

                  {/* Optional Partida per roll if provider config hasPartida is active */}
                  {pConfig && pConfig.hasPartida && group.source === 'custom' && (
                    <div className="w-24 shrink-0">
                      <input
                        type="text"
                        placeholder="Partida"
                        value={roll.partida || ''}
                        onChange={e => onRollFieldChange(group.id, roll.id, 'partida', e.target.value)}
                        className="w-full px-2 py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center"
                      />
                    </div>
                  )}

                  {/* Optional Tono per roll if provider config hasTono is active */}
                  {pConfig && pConfig.hasTono && (
                    <div className="w-24 shrink-0">
                      <input
                        type="text"
                        placeholder="Tono/Color"
                        value={roll.tono || ''}
                        onChange={e => onRollFieldChange(group.id, roll.id, 'tono', e.target.value)}
                        className="w-full px-2 py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center"
                      />
                    </div>
                  )}

                  {/* Optional Ancho per roll if provider config hasWidth is active */}
                  {pConfig && pConfig.hasWidth && (
                    <div className="w-24 shrink-0">
                      <input
                        type="text"
                        placeholder="Ancho"
                        value={roll.width || ''}
                        onChange={e => onRollFieldChange(group.id, roll.id, 'width', e.target.value)}
                        className="w-full px-2 py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center"
                      />
                    </div>
                  )}

                  {/* Optional Peso per roll if provider config hasWeight is active */}
                  {pConfig && pConfig.hasWeight && (
                    <div className="w-24 shrink-0">
                      <input
                        type="text"
                        placeholder="Peso"
                        value={roll.weight || ''}
                        onChange={e => onRollFieldChange(group.id, roll.id, 'weight', e.target.value)}
                        className="w-full px-2 py-1 border border-app-border rounded-md text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary uppercase placeholder:font-sans placeholder:font-normal text-center"
                      />
                    </div>
                  )}

                  {/* Delete roll button */}
                  <button
                    type="button"
                    onClick={() => onRemoveRoll(group.id, roll.id)}
                    className="text-app-text/45 hover:text-red-500 p-1 rounded hover:bg-app-bg transition cursor-pointer"
                    title="Eliminar este metraje"
                  >
                    <Trash2 size={13} />
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
        onScanResult={(scan) => onAddScannedRoll(group.id, scan)}
        availableRolls={availableRolls}
        groupArticleId={group.articleId}
      />
    </div>
  );
}
