// Converts a BRL value number to written Portuguese (e.g. 8000 → "oito mil reais")
export function valorPorExtenso(valor: number): string {
  if (valor === 0) return "zero reais";

  const centavos = Math.round((valor % 1) * 100);
  const reais = Math.floor(valor);

  const extensoReais = numeroPorExtenso(reais);
  const extensoCentavos = centavos > 0 ? numeroPorExtenso(centavos) : "";

  if (centavos === 0) {
    return `${extensoReais} ${reais === 1 ? "real" : "reais"}`;
  }
  return `${extensoReais} ${reais === 1 ? "real" : "reais"} e ${extensoCentavos} ${centavos === 1 ? "centavo" : "centavos"}`;
}

function numeroPorExtenso(n: number): string {
  if (n === 0) return "zero";

  const unidades = [
    "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete",
    "dezoito", "dezenove",
  ];
  const dezenas = [
    "", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta",
    "oitenta", "noventa",
  ];
  const centenas = [
    "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
    "seiscentos", "setecentos", "oitocentos", "novecentos",
  ];

  if (n < 20) return unidades[n];
  if (n < 100) {
    const dez = Math.floor(n / 10);
    const uni = n % 10;
    return uni === 0 ? dezenas[dez] : `${dezenas[dez]} e ${unidades[uni]}`;
  }
  if (n === 100) return "cem";
  if (n < 1000) {
    const cent = Math.floor(n / 100);
    const resto = n % 100;
    const centStr = centenas[cent];
    if (resto === 0) return centStr;
    return `${centStr} e ${numeroPorExtenso(resto)}`;
  }
  if (n < 1000000) {
    const mil = Math.floor(n / 1000);
    const resto = n % 1000;
    const milStr = mil === 1 ? "mil" : `${numeroPorExtenso(mil)} mil`;
    if (resto === 0) return milStr;
    return resto < 100
      ? `${milStr} e ${numeroPorExtenso(resto)}`
      : `${milStr}, ${numeroPorExtenso(resto)}`;
  }
  const milh = Math.floor(n / 1000000);
  const resto = n % 1000000;
  const milhStr =
    milh === 1 ? "um milhão" : `${numeroPorExtenso(milh)} milhões`;
  if (resto === 0) return milhStr;
  return `${milhStr}, ${numeroPorExtenso(resto)}`;
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

/**
 * Formata valor monetário em BRL SEM o símbolo R$ (ex: 15000 → "15.000,00").
 * Use nos templates Word onde o "R$" já está impresso no documento.
 */
export function formatarValor(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}
