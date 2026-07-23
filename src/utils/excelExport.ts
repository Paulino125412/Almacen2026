import ExcelJS from 'exceljs';
import { Client, Seller, Provider, Article, RollItem, PackingList } from '../types';

/**
 * Loads the company logo from /logo-juditex.png and converts it to base64 for ExcelJS.
 */
async function getLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/logo-juditex.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
        resolve(base64Data);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Logo could not be loaded for Excel export:', err);
    return null;
  }
}

/**
 * Adds the Juditex branded header to any worksheet
 */
async function addBrandedHeader(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  title: string,
  subtitle?: string,
  colCount: number = 7
) {
  const logoBase64 = await getLogoBase64();

  // Set generous row heights for title area
  worksheet.getRow(1).height = 28;
  worksheet.getRow(2).height = 32;
  worksheet.getRow(3).height = 26;
  worksheet.getRow(4).height = 12;

  if (logoBase64) {
    try {
      // Merge cells A1:B3 for a dedicated logo container
      worksheet.mergeCells('A1:B3');

      const imageId = workbook.addImage({
        base64: logoBase64,
        extension: 'png',
      });

      worksheet.addImage(imageId, {
        tl: { col: 0.05, row: 0.08 },
        ext: { width: 230, height: 82 },
        editAs: 'oneCell'
      });
    } catch (e) {
      console.warn('Failed to embed logo image:', e);
    }
  }

  // Text starts in Column 3 (C) if logo exists in A1:B3, or Column 1 (A) if no logo
  const startCol = logoBase64 ? 3 : 1;
  const endCol = Math.max(startCol + 3, colCount);

  // Safely merge title cells across header columns for clean typography
  const mergeTitleRow = (rowNumber: number) => {
    if (endCol > startCol) {
      try {
        worksheet.mergeCells(rowNumber, startCol, rowNumber, endCol);
      } catch (e) {
        // Fallback if already merged
      }
    }
  };

  // Company Name Header (Row 1)
  mergeTitleRow(1);
  const brandCell = worksheet.getCell(1, startCol);
  brandCell.value = 'JUDITEX - SUITE DE NEGOCIOS TEXTIL';
  brandCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF475569' } };
  brandCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Document Title Banner (Row 2)
  mergeTitleRow(2);
  const titleCell = worksheet.getCell(2, startCol);
  titleCell.value = title.toUpperCase();
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF0F766E' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Subtitle / Date Info (Row 3)
  mergeTitleRow(3);
  const nowStr = new Date().toLocaleString('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short'
  });
  const subCell = worksheet.getCell(3, startCol);
  subCell.value = `${subtitle || 'Reporte Oficial del Sistema'}  |  Fecha de emisión: ${nowStr}`;
  subCell.font = { name: 'Segoe UI', size: 8.5, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };

  // Row 4 is a blank separator
}

/**
 * Apply clean, elegant table header and data styling
 */
function styleTableHeaders(worksheet: ExcelJS.Worksheet, headerRowNumber: number, headers: string[]) {
  const row = worksheet.getRow(headerRowNumber);
  row.height = 24;

  headers.forEach((headerText, colIdx) => {
    const cell = row.getCell(colIdx + 1);
    cell.value = headerText;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    };
  });
}

/**
 * Helper to style data rows with zebra striping and borders
 */
function styleDataRow(
  row: ExcelJS.Row,
  isEven: boolean,
  colAlignments: ('left' | 'center' | 'right')[]
) {
  row.height = 20;
  const bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgArgb }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colAlignments[colNumber - 1] || 'left'
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  });
}

/**
 * Auto-fit column widths dynamically
 */
function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidths: number[] = []) {
  worksheet.columns.forEach((col, idx) => {
    let maxLen = minWidths[idx] || 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      // Ignore header title rows (1-4) so long title sentences don't distort column widths
      if (Number(cell.row) <= 4) return;
      const valStr = cell.value ? String(cell.value) : '';
      if (valStr.length > maxLen && valStr.length < 80) {
        maxLen = valStr.length;
      }
    });

    if (idx === 0) {
      // Column A: N° column
      col.width = Math.max(maxLen + 4, 12);
    } else if (idx === 1) {
      // Column B: Client / Article / Title main data column
      col.width = Math.max(maxLen + 4, 28);
    } else {
      col.width = Math.max(maxLen + 4, 14);
    }
  });
}

/**
 * Save workbook to browser download
 */
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ==========================================
// EXPORT FUNCTIONS
// ==========================================

/**
 * 1. Export Catalogs (Clients, Articles, Providers, Sellers)
 */
export async function exportCatalogToExcel(
  type: 'clients' | 'articles' | 'providers' | 'sellers',
  items: any[],
  extraContext?: { providers?: Provider[]; articles?: Article[] }
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JUDITEX';

  let sheetName = 'Catálogo';
  let title = 'Catálogo General';
  let headers: string[] = [];
  let alignments: ('left' | 'center' | 'right')[] = [];

  if (type === 'clients') {
    sheetName = 'Clientes';
    title = 'Catálogo Oficial de Clientes';
    headers = ['N°', 'Cliente / Razón Social', 'DNI / RUC', 'Correo Electrónico', 'Teléfono', 'Dirección de Despacho'];
    alignments = ['center', 'left', 'center', 'left', 'center', 'left'];
  } else if (type === 'articles') {
    sheetName = 'Artículos';
    title = 'Catálogo de Artículos y Telas';
    headers = ['N°', 'Nombre Tela / Artículo', 'Descripción / Gramaje', 'Proveedor Asociado', 'Unidad Medida'];
    alignments = ['center', 'left', 'left', 'left', 'center'];
  } else if (type === 'providers') {
    sheetName = 'Proveedores';
    title = 'Catálogo de Proveedores Dinámicos';
    headers = ['N°', 'Nombre Proveedor', 'Lote', 'Partida', 'Tono', 'Nº Rollo', 'Ancho', 'Peso'];
    alignments = ['center', 'left', 'center', 'center', 'center', 'center', 'center', 'center'];
  } else if (type === 'sellers') {
    sheetName = 'Vendedores';
    title = 'Catálogo de Vendedores';
    headers = ['N°', 'Nombre Vendedor', 'Correo Electrónico', 'Teléfono Móvil'];
    alignments = ['center', 'left', 'left', 'center'];
  }

  const worksheet = workbook.addWorksheet(sheetName);
  await addBrandedHeader(workbook, worksheet, title, `Total de registros: ${items.length}`, headers.length);

  const startRow = 5;
  styleTableHeaders(worksheet, startRow, headers);

  items.forEach((item, index) => {
    const rowNum = startRow + 1 + index;
    const row = worksheet.getRow(rowNum);

    if (type === 'clients') {
      row.values = [index + 1, item.name || '', item.dni || '-', item.email || '-', item.phone || '-', item.address || '-'];
    } else if (type === 'articles') {
      const provName = extraContext?.providers?.find(p => p.id === item.providerId)?.name || 'N/A';
      row.values = [index + 1, item.name || '', item.description || '-', provName, item.unit || 'metros'];
    } else if (type === 'providers') {
      row.values = [
        index + 1,
        item.name || '',
        item.hasLot ? 'SÍ' : 'NO',
        item.hasPartida ? 'SÍ' : 'NO',
        item.hasTono ? 'SÍ' : 'NO',
        (item.hasRollNo ?? true) ? 'SÍ' : 'NO',
        item.hasWidth ? 'SÍ' : 'NO',
        item.hasWeight ? 'SÍ' : 'NO'
      ];
    } else if (type === 'sellers') {
      row.values = [index + 1, item.name || '', item.email || '-', item.phone || '-'];
    }

    styleDataRow(row, index % 2 === 1, alignments);
  });

  autoFitColumns(worksheet);
  const dateStr = new Date().toISOString().split('T')[0];
  await downloadWorkbook(workbook, `Catalogo_${sheetName}_Juditex_${dateStr}`);
}

/**
 * 2. Export Inventory of Fabric Rolls
 */
export async function exportInventoryToExcel(
  inventory: RollItem[],
  articles: Article[],
  providers: Provider[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JUDITEX';

  const worksheet = workbook.addWorksheet('Inventario de Telas');

  const hasWidth = inventory.some(item => item.width && item.width.trim() !== '');
  const hasWeight = inventory.some(item => item.weight && item.weight.trim() !== '');

  const totalMetersAvailable = inventory.reduce((acc, item) => acc + item.currentMeters, 0);
  const totalMetersInitial = inventory.reduce((acc, item) => acc + item.initialMeters, 0);

  await addBrandedHeader(
    workbook,
    worksheet,
    'Reporte General de Inventario de Telas',
    `Rollos en consulta: ${inventory.length} | Stock Disponible Total: ${totalMetersAvailable.toFixed(2)} m`,
    12
  );

  const headers = ['N°', 'Nº Rollo', 'Artículo / Tela', 'Proveedor', 'Lote', 'Partida', 'Tono'];
  const alignments: ('left' | 'center' | 'right')[] = ['center', 'center', 'left', 'left', 'center', 'center', 'center'];

  if (hasWidth) {
    headers.push('Ancho');
    alignments.push('center');
  }
  if (hasWeight) {
    headers.push('Peso');
    alignments.push('center');
  }

  headers.push('Mts. Iniciales', 'Mts. Disponibles', 'Estado', 'Fecha Ingreso');
  alignments.push('right', 'right', 'center', 'center');

  const startRow = 5;
  styleTableHeaders(worksheet, startRow, headers);

  inventory.forEach((item, index) => {
    const rowNum = startRow + 1 + index;
    const row = worksheet.getRow(rowNum);

    const art = articles.find(a => a.id === item.articleId)?.name || 'Desconocido';
    const prov = providers.find(p => p.id === item.providerId)?.name || 'Desconocido';
    const statusLabel = item.currentMeters > 0 ? 'DISPONIBLE' : 'AGOTADO';
    const formattedDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-PE') : '-';

    const values: any[] = [
      index + 1,
      item.rollNumber,
      art,
      prov,
      item.lot || '-',
      item.partida || '-',
      item.tono || '-'
    ];

    if (hasWidth) values.push(item.width || '-');
    if (hasWeight) values.push(item.weight || '-');

    values.push(
      Number(item.initialMeters.toFixed(2)),
      Number(item.currentMeters.toFixed(2)),
      statusLabel,
      formattedDate
    );

    row.values = values;
    styleDataRow(row, index % 2 === 1, alignments);

    // Number format for meter columns
    const initialCell = row.getCell(values.length - 3);
    const availableCell = row.getCell(values.length - 2);
    initialCell.numFmt = '#,##0.00 "m"';
    availableCell.numFmt = '#,##0.00 "m"';

    // Status color
    const statusCell = row.getCell(values.length - 1);
    if (item.currentMeters > 0) {
      statusCell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF166534' } }; // Green
    } else {
      statusCell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF94A3B8' } }; // Gray
    }
  });

  // Footer Totals Row
  const lastDataRow = startRow + inventory.length;
  const summaryRow = worksheet.getRow(lastDataRow + 1);
  summaryRow.height = 24;

  const totalColCount = headers.length;
  summaryRow.getCell(2).value = 'TOTALES GENERALES';
  summaryRow.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };

  // Set totals in correct columns
  const initMtsColIdx = totalColCount - 3;
  const availMtsColIdx = totalColCount - 2;

  const initMtsCell = summaryRow.getCell(initMtsColIdx);
  initMtsCell.value = Number(totalMetersInitial.toFixed(2));
  initMtsCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  initMtsCell.numFmt = '#,##0.00 "m"';
  initMtsCell.alignment = { horizontal: 'right', vertical: 'middle' };

  const availMtsCell = summaryRow.getCell(availMtsColIdx);
  availMtsCell.value = Number(totalMetersAvailable.toFixed(2));
  availMtsCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF0F766E' } };
  availMtsCell.numFmt = '#,##0.00 "m"';
  availMtsCell.alignment = { horizontal: 'right', vertical: 'middle' };

  // Top thick border for footer
  summaryRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
  });

  autoFitColumns(worksheet);
  const dateStr = new Date().toISOString().split('T')[0];
  await downloadWorkbook(workbook, `Inventario_Telas_Juditex_${dateStr}`);
}

/**
 * 3. Export Packing Lists Summary
 */
export async function exportPackingListSummaryToExcel(
  filteredLists: PackingList[],
  clients: Client[],
  sellers: Seller[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JUDITEX';

  const worksheet = workbook.addWorksheet('Resumen de Despachos');

  const totalMeters = filteredLists.reduce((sum, pl) => {
    return sum + pl.items.reduce((acc, item) => acc + item.meters, 0);
  }, 0);

  const totalRolls = filteredLists.reduce((sum, pl) => sum + pl.items.length, 0);

  await addBrandedHeader(
    workbook,
    worksheet,
    'Resumen General de Despachos y Packing Lists',
    `Despachos listados: ${filteredLists.length} | Total Metros: ${totalMeters.toFixed(2)} m | Total Rollos: ${totalRolls}`,
    8
  );

  const headers = [
    'N°',
    'Nº Packing List',
    'Fecha Despacho',
    'Cliente / Razón Social',
    'Vendedor',
    'Cant. Ítems / Rollos',
    'Metraje Despachado (m)',
    'Observaciones'
  ];

  const alignments: ('left' | 'center' | 'right')[] = [
    'center', 'center', 'center', 'left', 'left', 'center', 'right', 'left'
  ];

  const startRow = 5;
  styleTableHeaders(worksheet, startRow, headers);

  filteredLists.forEach((pl, index) => {
    const rowNum = startRow + 1 + index;
    const row = worksheet.getRow(rowNum);

    const clientName = clients.find(c => c.id === pl.clientId)?.name || 'Cliente Eliminado';
    const sellerName = sellers.find(s => s.id === pl.sellerId)?.name || 'Vendedor Eliminado';
    const plMeters = pl.items.reduce((acc, item) => acc + item.meters, 0);

    row.values = [
      index + 1,
      pl.packingListNo,
      pl.date,
      clientName,
      sellerName,
      pl.items.length,
      Number(plMeters.toFixed(2)),
      pl.notes || ''
    ];

    styleDataRow(row, index % 2 === 1, alignments);

    // Number format for meters
    const mtsCell = row.getCell(7);
    mtsCell.numFmt = '#,##0.00 "m"';
  });

  // Footer Totals Row
  const lastRow = startRow + filteredLists.length;
  const summaryRow = worksheet.getRow(lastRow + 1);
  summaryRow.height = 24;

  summaryRow.getCell(4).value = 'TOTALES DESPACHADOS:';
  summaryRow.getCell(4).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };

  const rollsCell = summaryRow.getCell(6);
  rollsCell.value = totalRolls;
  rollsCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  rollsCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const metersCell = summaryRow.getCell(7);
  metersCell.value = Number(totalMeters.toFixed(2));
  metersCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF0F766E' } };
  metersCell.numFmt = '#,##0.00 "m"';
  metersCell.alignment = { horizontal: 'right', vertical: 'middle' };

  summaryRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
  });

  autoFitColumns(worksheet);
  const dateStr = new Date().toISOString().split('T')[0];
  await downloadWorkbook(workbook, `Resumen_Despachos_Juditex_${dateStr}`);
}

/**
 * 4. Export Detailed Roll-by-Roll List of filtered Packing Lists
 */
export async function exportPackingListFullDetailsToExcel(
  filteredLists: PackingList[],
  articles: Article[],
  clients: Client[],
  sellers: Seller[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JUDITEX';

  const worksheet = workbook.addWorksheet('Detalle de Rollos Despachados');

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

  let totalMeters = 0;
  let totalRolls = 0;

  filteredLists.forEach(pl => {
    pl.items.forEach(item => {
      totalMeters += item.meters;
      totalRolls++;
    });
  });

  await addBrandedHeader(
    workbook,
    worksheet,
    'Detalle General de Rollos Despachados',
    `Total Rollos: ${totalRolls} | Metraje Acumulado: ${totalMeters.toFixed(2)} m`,
    15
  );

  const headers = [
    'N°',
    'Nº Packing List',
    'Fecha Despacho',
    'Cliente / Razón Social',
    'Vendedor',
    'Artículo / Tela',
    'Descripción',
    'Rollo / Corte Nº'
  ];

  const alignments: ('left' | 'center' | 'right')[] = [
    'center', 'center', 'center', 'left', 'left', 'left', 'left', 'center'
  ];

  if (hasLote) { headers.push('Lote'); alignments.push('center'); }
  if (hasPartida) { headers.push('Partida'); alignments.push('center'); }
  if (hasTono) { headers.push('Tono'); alignments.push('center'); }
  if (hasWidth) { headers.push('Ancho'); alignments.push('center'); }
  if (hasWeight) { headers.push('Peso'); alignments.push('center'); }

  headers.push('Metraje Despachado (m)', 'Notas / Observaciones');
  alignments.push('right', 'left');

  const startRow = 5;
  styleTableHeaders(worksheet, startRow, headers);

  let itemCounter = 0;

  filteredLists.forEach(pl => {
    const clientName = clients.find(c => c.id === pl.clientId)?.name || 'Cliente Eliminado';
    const sellerName = sellers.find(s => s.id === pl.sellerId)?.name || 'Vendedor Eliminado';

    pl.items.forEach(item => {
      itemCounter++;
      const rowNum = startRow + itemCounter;
      const row = worksheet.getRow(rowNum);

      const articleObj = articles.find(a => a.id === item.articleId);

      const rowValues: any[] = [
        itemCounter,
        pl.packingListNo,
        pl.date,
        clientName,
        sellerName,
        articleObj?.name || item.articleId || 'Desconocido',
        articleObj?.description || '-',
        item.rollNumber
      ];

      if (hasLote) rowValues.push(item.lot || '-');
      if (hasPartida) rowValues.push(item.partida || '-');
      if (hasTono) rowValues.push(item.tono || '-');
      if (hasWidth) rowValues.push(item.width || '-');
      if (hasWeight) rowValues.push(item.weight || '-');

      rowValues.push(
        Number(item.meters.toFixed(2)),
        pl.notes || ''
      );

      row.values = rowValues;
      styleDataRow(row, itemCounter % 2 === 0, alignments);

      // Meter format
      const meterColIdx = headers.length - 1;
      const meterCell = row.getCell(meterColIdx);
      meterCell.numFmt = '#,##0.00 "m"';
    });
  });

  // Summary Row
  const lastRow = startRow + itemCounter;
  const summaryRow = worksheet.getRow(lastRow + 1);
  summaryRow.height = 24;

  summaryRow.getCell(4).value = 'TOTALES DESPACHADOS:';
  summaryRow.getCell(4).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };

  const meterColIdx = headers.length - 1;
  const meterCell = summaryRow.getCell(meterColIdx);
  meterCell.value = Number(totalMeters.toFixed(2));
  meterCell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF0F766E' } };
  meterCell.numFmt = '#,##0.00 "m"';
  meterCell.alignment = { horizontal: 'right', vertical: 'middle' };

  summaryRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
  });

  autoFitColumns(worksheet);
  const dateStr = new Date().toISOString().split('T')[0];
  await downloadWorkbook(workbook, `Detalle_Rollos_Despachados_Juditex_${dateStr}`);
}

/**
 * 5. Export Single Packing List document to Excel
 */
export async function exportSinglePackingListToExcel(
  pl: PackingList,
  client?: Client,
  seller?: Seller,
  articles?: Article[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JUDITEX';

  const sheetName = `PL ${pl.packingListNo}`;
  const worksheet = workbook.addWorksheet(sheetName);

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

  const totalMeters = pl.items.reduce((acc, item) => acc + item.meters, 0);

  await addBrandedHeader(
    workbook,
    worksheet,
    `DOCUMENTO DE PACKING LIST - N° ${pl.packingListNo}`,
    `Fecha: ${pl.date} | Cliente: ${client?.name || 'N/A'}`,
    10
  );

  // Client and Seller Info Box (Rows 5 to 8)
  const metaBoxRows = [
    ['Nº Packing List:', pl.packingListNo, 'Fecha Despacho:', pl.date],
    ['Cliente / Raz. Soc.:', client?.name || '-', 'DNI / RUC:', client?.dni || '-'],
    ['Vendedor:', seller?.name || '-', 'Dirección:', client?.address || '-'],
    ['Observaciones:', pl.notes || 'Ninguna', 'Guía Remisión N°:', pl.guideNumber || '-']
  ];

  metaBoxRows.forEach((rowVals, rIdx) => {
    const rowNum = 5 + rIdx;
    const row = worksheet.getRow(rowNum);
    row.height = 18;

    row.getCell(1).value = rowVals[0];
    row.getCell(1).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };

    row.getCell(2).value = rowVals[1];
    row.getCell(2).font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FF1E293B' } };

    row.getCell(4).value = rowVals[2];
    row.getCell(4).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF475569' } };

    row.getCell(5).value = rowVals[3];
    row.getCell(5).font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
  });

  // Table Headers at Row 10
  const startRow = 10;
  const headers = ['N°', 'Artículo / Tela', 'Descripción Tela'];
  const alignments: ('left' | 'center' | 'right')[] = ['center', 'left', 'left'];

  if (hasLote) { headers.push('Lote'); alignments.push('center'); }
  if (hasPartida) { headers.push('Partida'); alignments.push('center'); }
  if (hasTono) { headers.push('Tono'); alignments.push('center'); }
  if (hasWidth) { headers.push('Ancho'); alignments.push('center'); }
  if (hasWeight) { headers.push('Peso'); alignments.push('center'); }

  headers.push('Rollo / Corte N°', 'Metraje (m)');
  alignments.push('center', 'right');

  styleTableHeaders(worksheet, startRow, headers);

  pl.items.forEach((item, index) => {
    const rowNum = startRow + 1 + index;
    const row = worksheet.getRow(rowNum);

    const artObj = articles?.find(a => a.id === item.articleId);

    const rowValues: any[] = [
      index + 1,
      artObj?.name || item.articleId || 'Desconocido',
      artObj?.description || '-'
    ];

    if (hasLote) rowValues.push(item.lot || '-');
    if (hasPartida) rowValues.push(item.partida || '-');
    if (hasTono) rowValues.push(item.tono || '-');
    if (hasWidth) rowValues.push(item.width || '-');
    if (hasWeight) rowValues.push(item.weight || '-');

    rowValues.push(item.rollNumber, Number(item.meters.toFixed(2)));

    row.values = rowValues;
    styleDataRow(row, index % 2 === 1, alignments);

    const metersColIdx = headers.length;
    const metersCell = row.getCell(metersColIdx);
    metersCell.numFmt = '#,##0.00 "m"';
  });

  // Totals Footer Row
  const lastRow = startRow + pl.items.length;
  const summaryRow = worksheet.getRow(lastRow + 1);
  summaryRow.height = 24;

  summaryRow.getCell(2).value = 'TOTAL DESPACHADO';
  summaryRow.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };

  const rollColIdx = headers.length - 1;
  const metersColIdx = headers.length;

  const rollCell = summaryRow.getCell(rollColIdx);
  rollCell.value = `${pl.items.length} rollos`;
  rollCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  rollCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const metersCell = summaryRow.getCell(metersColIdx);
  metersCell.value = Number(totalMeters.toFixed(2));
  metersCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F766E' } };
  metersCell.numFmt = '#,##0.00 "m"';
  metersCell.alignment = { horizontal: 'right', vertical: 'middle' };

  summaryRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } }
    };
  });

  autoFitColumns(worksheet);
  await downloadWorkbook(workbook, `PackingList_${pl.packingListNo}_Juditex`);
}
