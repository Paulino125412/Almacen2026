import React, { useState } from 'react';
import { Provider } from '../../types';

// Helper to parse and classify Excel columns based on content heuristics and provider configuration
export const resolveColumnsForText = (text: string, pConfig: Provider | null | undefined) => {
  const rawLines = text.split(/[\r\n]+/);
  const lines = rawLines.map(l => l.trim()).filter(Boolean);
  
  let rollColIdx = -1;
  let metersColIdx = -1;
  let lotColIdx = -1;
  let partidaColIdx = -1;
  let tonoColIdx = -1;
  let widthColIdx = -1;
  let weightColIdx = -1;
  let startLineIndex = 0;

  if (lines.length === 0) {
    return {
      metersColIdx,
      rollColIdx,
      lotColIdx,
      partidaColIdx,
      tonoColIdx,
      widthColIdx,
      weightColIdx,
      startLineIndex,
      lines,
      colHeaders: [] as string[],
      splitIntoColumns: (lineStr: string) => [] as string[]
    };
  }

  const splitIntoColumns = (lineStr: string): string[] => {
    let cols: string[] = [];
    if (lineStr.includes('\t')) {
      cols = lineStr.split('\t');
    } else if (lineStr.includes(';')) {
      cols = lineStr.split(';');
    } else if (/\s{2,}/.test(lineStr)) {
      cols = lineStr.split(/\s{2,}/);
    } else {
      cols = lineStr.split(/\s+/);
    }
    return cols.map(c => c.trim()).filter(Boolean);
  };

  // 1. Check if first line is a header
  let firstLineCols = splitIntoColumns(lines[0]).map(c => c.toLowerCase());
  const isHeader = firstLineCols.some(word => 
    /rollo|nro|num|metr|cant|qty|peso|lote|part|tono|col|shad|anch|width/i.test(word)
  );

  if (isHeader) {
    startLineIndex = 1;
    firstLineCols.forEach((col, idx) => {
      if (/roll|nro|num|item|id/i.test(col)) rollColIdx = idx;
      else if (/metr|cant|qty|size|long|mts|mtr/i.test(col)) metersColIdx = idx;
      else if (/lote|lot/i.test(col)) lotColIdx = idx;
      else if (/part/i.test(col)) partidaColIdx = idx;
      else if (/tono|col|shad/i.test(col)) tonoColIdx = idx;
      else if (/anch|width|anchura|anc/i.test(col)) widthColIdx = idx;
      else if (/peso|weight|kg|kgs|pso/i.test(col)) weightColIdx = idx;
    });
  }

  // 2. Perform dynamic guessing for unassigned active columns
  const dataLines = lines.slice(startLineIndex);
  if (dataLines.length > 0) {
    const sampleRows: string[][] = [];
    for (let i = 0; i < Math.min(dataLines.length, 15); i++) {
      const cols = splitIntoColumns(dataLines[i]);
      if (cols.length > 0) {
        sampleRows.push(cols);
      }
    }

    if (sampleRows.length > 0) {
      const maxColsCount = Math.max(...sampleRows.map(r => r.length));
      const colAnalysis: Array<{
        index: number;
        isNumeric: boolean;
        allNumeric: boolean;
        avgVal: number;
        minVal: number;
        maxVal: number;
        avgLength: number;
        avgDigits: number;
        avgLetters: number;
        hasLetters: boolean;
      }> = [];

      for (let colIdx = 0; colIdx < maxColsCount; colIdx++) {
        const vals = sampleRows
          .map(r => r[colIdx])
          .filter(v => v !== undefined && v !== '');

        let numericCount = 0;
        let sum = 0;
        let min = Infinity;
        let max = -Infinity;
        let totalLength = 0;
        let totalDigits = 0;
        let totalLetters = 0;

        vals.forEach(v => {
          const cleanedVal = v.trim();
          totalLength += cleanedVal.length;
          const digits = cleanedVal.replace(/[^0-9]/g, '').length;
          totalDigits += digits;
          const letters = cleanedVal.replace(/[^a-zA-Z]/g, '').length;
          totalLetters += letters;

          const numericCleaned = cleanedVal.replace(/m|mts|mt|kg|kgs/i, '').replace(',', '.').trim();
          const n = parseFloat(numericCleaned);
          if (!isNaN(n)) {
            numericCount++;
            sum += n;
            if (n < min) min = n;
            if (n > max) max = n;
          }
        });

        colAnalysis.push({
          index: colIdx,
          isNumeric: numericCount > vals.length * 0.5,
          allNumeric: numericCount === vals.length,
          avgVal: numericCount > 0 ? sum / numericCount : 0,
          minVal: min === Infinity ? 0 : min,
          maxVal: max === -Infinity ? 0 : max,
          avgLength: vals.length > 0 ? totalLength / vals.length : 0,
          avgDigits: vals.length > 0 ? totalDigits / vals.length : 0,
          avgLetters: vals.length > 0 ? totalLetters / vals.length : 0,
          hasLetters: totalLetters > 0
        });
      }

      // We want to assign active roles
      const activeRoles: string[] = [];
      
      // Check which roles are defined and which ones haven't been assigned by headers
      if (metersColIdx === -1) activeRoles.push('meters');
      if (pConfig?.hasRollNo && rollColIdx === -1) activeRoles.push('rollNo');
      if (pConfig?.hasWidth && widthColIdx === -1) activeRoles.push('width');
      if (pConfig?.hasWeight && weightColIdx === -1) activeRoles.push('weight');
      if (pConfig?.hasLot && lotColIdx === -1) activeRoles.push('lot');
      if (pConfig?.hasPartida && partidaColIdx === -1) activeRoles.push('partida');
      if (pConfig?.hasTono && tonoColIdx === -1) activeRoles.push('tono');

      const getRoleScore = (col: typeof colAnalysis[0], role: string) => {
        if (role === 'meters') {
          if (!col.isNumeric) return -1000;
          let score = 50;
          // Metraje typically around 40m to 250m
          if (col.avgVal >= 40 && col.avgVal <= 250) {
            score += 100;
          } else if (col.avgVal >= 5 && col.avgVal <= 400) {
            score += 40;
          }
          if (col.avgVal !== Math.round(col.avgVal)) {
            score += 30; // decimals are very common in meters
          }
          return score;
        }

        if (role === 'weight') {
          if (!col.isNumeric) return -1000;
          let score = 30;
          // Weight typically 20 to 90 kg
          if (col.avgVal >= 15 && col.avgVal <= 100) {
            score += 100;
          } else if (col.avgVal >= 5 && col.avgVal <= 150) {
            score += 30;
          }
          return score;
        }

        if (role === 'width') {
          if (!col.isNumeric) return -1000;
          // Width: 0.8 to 3.0 meters
          if (col.avgVal >= 0.8 && col.avgVal <= 3.0) {
            let score = 150;
            if (col.maxVal - col.minVal < 0.5) score += 50; // stable width
            return score;
          }
          if (col.avgVal > 5.0) return -1000;
          return 0;
        }

        if (role === 'rollNo') {
          let score = 10;
          // Roll number is mostly > 8 digits, can contain letters or numbers
          if (col.avgDigits >= 8) {
            score += 150;
          } else if (col.avgDigits >= 5) {
            score += 80;
          } else if (col.avgDigits >= 1) {
            score += 40;
          }
          if (col.index === 0) {
            score += 40; // highly likely leftmost
          }
          return score;
        }

        if (role === 'lot') {
          let score = 10;
          // Lot typically 4 or fewer characters
          if (col.avgLength > 0 && col.avgLength <= 4) {
            score += 120;
          } else if (col.avgLength > 4 && col.avgLength <= 7) {
            score += 50;
          } else if (col.avgLength > 7) {
            score -= 100;
          }
          return score;
        }

        if (role === 'partida') {
          let score = 10;
          // Partida is typically ~6 digits
          if (col.avgDigits >= 5 && col.avgDigits <= 7) {
            score += 120;
          } else if (col.avgDigits > 0 && col.avgDigits < 5) {
            score += 40;
          } else if (col.avgDigits > 7) {
            score += 20;
          }
          return score;
        }

        if (role === 'tono') {
          let score = 10;
          if (col.avgLetters > 0) {
            score += 40;
          }
          if (col.avgLength > 0 && col.avgLength <= 3) {
            score += 60;
          }
          return score;
        }

        return 0;
      };

      const availableCols = colAnalysis
        .map(col => col.index)
        .filter(idx => idx !== rollColIdx && idx !== metersColIdx && idx !== lotColIdx && idx !== partidaColIdx && idx !== tonoColIdx && idx !== widthColIdx && idx !== weightColIdx);

      let bestMapping: { [role: string]: number } = {};
      let maxTotalScore = -Infinity;

      const searchMapping = (
        roleIdx: number,
        currentMapping: { [role: string]: number },
        usedCols: Set<number>
      ) => {
        if (roleIdx === activeRoles.length) {
          let score = 0;
          activeRoles.forEach(role => {
            const colIdx = currentMapping[role];
            const col = colAnalysis[colIdx];
            score += getRoleScore(col, role);
          });

          // Relations
          const mCol = currentMapping['meters'] !== undefined ? currentMapping['meters'] : metersColIdx;
          const wCol = currentMapping['weight'] !== undefined ? currentMapping['weight'] : weightColIdx;
          const rCol = currentMapping['rollNo'] !== undefined ? currentMapping['rollNo'] : rollColIdx;
          const lCol = currentMapping['lot'] !== undefined ? currentMapping['lot'] : lotColIdx;
          const pCol = currentMapping['partida'] !== undefined ? currentMapping['partida'] : partidaColIdx;

          // Meters vs Weight check
          if (mCol !== -1 && wCol !== -1) {
            const metersAvg = colAnalysis[mCol]?.avgVal || 0;
            const weightAvg = colAnalysis[wCol]?.avgVal || 0;
            if (metersAvg > weightAvg) {
              score += 150;
            } else {
              score -= 150;
            }
          }

          // Positioning heuristics
          if (rCol !== -1 && mCol !== -1) {
            if (rCol < mCol) score += 40;
          }
          if (lCol !== -1 && mCol !== -1) {
            if (lCol < mCol) score += 25;
          }
          if (pCol !== -1 && mCol !== -1) {
            if (pCol < mCol) score += 25;
          }

          if (score > maxTotalScore) {
            maxTotalScore = score;
            bestMapping = { ...currentMapping };
          }
          return;
        }

        const role = activeRoles[roleIdx];
        for (let i = 0; i < availableCols.length; i++) {
          const colIdx = availableCols[i];
          if (!usedCols.has(colIdx)) {
            usedCols.add(colIdx);
            currentMapping[role] = colIdx;
            searchMapping(roleIdx + 1, currentMapping, usedCols);
            delete currentMapping[role];
            usedCols.delete(colIdx);
          }
        }
      };

      searchMapping(0, {}, new Set<number>());

      // Assign dynamic indices
      if (bestMapping['meters'] !== undefined) metersColIdx = bestMapping['meters'];
      if (bestMapping['rollNo'] !== undefined) rollColIdx = bestMapping['rollNo'];
      if (bestMapping['width'] !== undefined) widthColIdx = bestMapping['width'];
      if (bestMapping['weight'] !== undefined) weightColIdx = bestMapping['weight'];
      if (bestMapping['lot'] !== undefined) lotColIdx = bestMapping['lot'];
      if (bestMapping['partida'] !== undefined) partidaColIdx = bestMapping['partida'];
      if (bestMapping['tono'] !== undefined) tonoColIdx = bestMapping['tono'];

      // Assign remaining active roles to leftover columns
      const stillActiveRoles = activeRoles.filter(role => bestMapping[role] === undefined);
      if (stillActiveRoles.length > 0) {
        const remainingUnused = availableCols.filter(idx => !Object.values(bestMapping).includes(idx));
        stillActiveRoles.forEach((role, rIdx) => {
          if (remainingUnused[rIdx] !== undefined) {
            const colIdx = remainingUnused[rIdx];
            if (role === 'meters') metersColIdx = colIdx;
            else if (role === 'rollNo') rollColIdx = colIdx;
            else if (role === 'width') widthColIdx = colIdx;
            else if (role === 'weight') weightColIdx = colIdx;
            else if (role === 'lot') lotColIdx = colIdx;
            else if (role === 'partida') partidaColIdx = colIdx;
            else if (role === 'tono') tonoColIdx = colIdx;
          }
        });
      }
    }
  }

  // Build column headers mapping
  const colHeaders: string[] = [];
  const linesToScan = lines.slice(startLineIndex);
  const maxCols = Math.max(
    rollColIdx, metersColIdx, lotColIdx, partidaColIdx, tonoColIdx, widthColIdx, weightColIdx,
    linesToScan[0] ? splitIntoColumns(linesToScan[0]).length - 1 : 0
  ) + 1;

  for (let i = 0; i < maxCols; i++) {
    const roles: string[] = [];
    if (i === rollColIdx) roles.push('Nº ROLLO');
    if (i === metersColIdx) roles.push('METRAJE');
    if (i === lotColIdx) roles.push('LOTE');
    if (i === partidaColIdx) roles.push('PARTIDA');
    if (i === tonoColIdx) roles.push('TONO/COLOR');
    if (i === widthColIdx) roles.push('ANCHO');
    if (i === weightColIdx) roles.push('PESO');

    if (roles.length > 0) {
      colHeaders[i] = roles.join(' / ');
    } else {
      colHeaders[i] = 'IGNORADO';
    }
  }

  return {
    metersColIdx,
    rollColIdx,
    lotColIdx,
    partidaColIdx,
    tonoColIdx,
    widthColIdx,
    weightColIdx,
    startLineIndex,
    lines,
    colHeaders,
    splitIntoColumns
  };
};

interface ExcelPasteParserProps {
  groupId: string;
  pConfig: Provider | null | undefined;
  isExcelOnly: boolean;
  packingType: 'nuevo' | 'antiguo' | 'corte' | 'rollo';
  onProcess: (text: string) => void;
}

export default function ExcelPasteParser({
  groupId,
  pConfig,
  isExcelOnly,
  packingType,
  onProcess
}: ExcelPasteParserProps) {
  const [text, setText] = useState('');

  const handleProcess = () => {
    if (!text.trim()) return;
    onProcess(text);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) return;
      e.preventDefault();
      handleProcess();
    }
  };

  const bulkVal = text.trim();
  const showPreview = (() => {
    if (!bulkVal) return false;
    const res = resolveColumnsForText(bulkVal, pConfig);
    return res.lines.length > 1 || bulkVal.includes('\t') || bulkVal.includes(';') || /\s{2,}/.test(bulkVal);
  })();

  const previewRes = showPreview ? resolveColumnsForText(bulkVal, pConfig) : null;

  return (
    <div className="bg-app-bg border border-app-border p-3.5 rounded-lg space-y-2 text-app-text">
      <label className="block text-[10px] font-black text-app-text uppercase tracking-wider flex items-center gap-1">
        {isExcelOnly ? 'Pegar desde Excel' : 'Ingreso de Metrajes (Individual o Excel)'}
      </label>
      <div className="flex gap-2 items-start">
        <div className="relative flex-1">
          <textarea
            rows={1}
            placeholder={isExcelOnly 
              ? "Pegue aquí las columnas copiadas de Excel (Nº Rollo, Metraje, Ancho, Peso)..."
              : packingType === 'corte' 
                ? "Ej: 12.50 [ENTER] para agregar individual, o pegue tabla de Excel completa..." 
                : "Ej: 45.80 [ENTER] para agregar individual, o pegue tabla de Excel completa..."}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 border border-app-border rounded-lg text-xs font-mono font-bold text-app-text bg-app-surface focus:ring-1 focus:ring-app-primary placeholder:font-sans placeholder:font-normal placeholder:text-app-text/45 min-h-[44px]"
          />
        </div>
        
        <button
          type="button"
          onClick={handleProcess}
          className="px-4 py-2.5 bg-app-primary hover:bg-app-primary/90 text-white font-bold rounded-lg text-xs transition cursor-pointer self-stretch flex items-center justify-center whitespace-nowrap min-h-[44px]"
        >
          {isExcelOnly 
            ? 'Pegar desde Excel'
            : text.includes('\n') || text.includes('\t') 
              ? 'Procesar Excel' 
              : 'Agregar'}
        </button>
      </div>

      {previewRes && (
        <div className="mt-3 bg-app-surface border border-app-border rounded-lg p-3.5 shadow-xs space-y-2">
          <div className="flex justify-between items-center border-b pb-2 border-app-border">
            <span className="text-[10px] font-black text-app-text uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-app-secondary animate-pulse"></span>
              Vista Preliminar de Columnas Detectadas
            </span>
            <span className="text-[9px] font-mono font-extrabold text-app-text/60 bg-app-bg px-1.5 py-0.5 rounded">
              {previewRes.lines.length} fila(s) detectada(s)
            </span>
          </div>

          <div className="overflow-x-auto border border-app-border rounded-md">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-app-bg border-b border-app-border">
                  {previewRes.colHeaders.map((header, hIdx) => {
                    let bgClass = 'bg-app-bg text-app-text/60 border-app-border';
                    if (header.includes('ROLLO')) bgClass = 'bg-app-bg text-app-text border-app-border font-bold';
                    else if (header.includes('METRAJE')) bgClass = 'bg-app-bg text-app-secondary border-app-secondary/35 font-bold';
                    else if (header.includes('LOTE')) bgClass = 'bg-app-bg text-app-primary border-app-primary/35 font-bold';
                    else if (header.includes('PARTIDA')) bgClass = 'bg-app-bg text-app-primary border-app-primary/35 font-bold';
                    else if (header.includes('TONO')) bgClass = 'bg-app-bg text-app-primary border-app-primary/35 font-bold';
                    else if (header.includes('ANCHO')) bgClass = 'bg-app-bg text-app-secondary border-app-secondary/35 font-bold';
                    else if (header.includes('PESO')) bgClass = 'bg-app-bg text-app-secondary border-app-secondary/35 font-bold';

                    return (
                      <th key={hIdx} className={`px-2 py-1.5 border-r border-app-border last:border-r-0 text-[10px] text-center font-extrabold tracking-wide uppercase ${bgClass}`}>
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] text-app-text/50 font-mono font-medium block">Col {hIdx + 1}</span>
                          <span>{header}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {previewRes.lines.slice(previewRes.startLineIndex, previewRes.startLineIndex + 5).map((line, rIdx) => {
                  const cols = previewRes.splitIntoColumns(line);
                  return (
                    <tr key={rIdx} className="border-b last:border-b-0 border-app-border hover:bg-app-bg/40">
                      {previewRes.colHeaders.map((_, cIdx) => {
                        const val = cols[cIdx] || '';
                        return (
                          <td key={cIdx} className="px-2 py-1.5 border-r border-app-border last:border-r-0 text-[10px] text-center font-mono font-bold text-app-text">
                            {val || <span className="text-app-text/30 italic">-</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {previewRes.lines.length > previewRes.startLineIndex + 5 && (
            <p className="text-[9px] text-center italic text-app-text/50">
              Mostrando las primeras 5 filas de vista previa. Haga clic en <strong>"Procesar Excel"</strong> para cargarlas todas.
            </p>
          )}
        </div>
      )}

      <p className="text-[9px] text-app-text/65 leading-relaxed">
        {isExcelOnly ? (
          <span>
            <strong>Requisito obligatorio:</strong> Copie y pegue directamente las columnas desde su hoja de Excel (Nº Rollo, Metraje, Ancho, Peso). El sistema identificará y asignará cada parámetro en su celda respectiva de inmediato.
          </span>
        ) : (
          <span>
            <strong>Consejo rápido:</strong> Escriba un número y presione ENTER, o pegue directamente una tabla copiada desde Excel (que incluya Nº Rollo, Metraje, Lote, Partida, Tono). El sistema reconocerá automáticamente los campos y rellenará la sección de inmediato.
          </span>
        )}
      </p>
    </div>
  );
}
