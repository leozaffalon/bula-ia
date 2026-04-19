export function buildOfficialSources(analysis) {
  const medicine = analysis?.identifiedMedicine || {};
  const query =
    medicine.name && !medicine.name.startsWith("Nao foi possivel")
      ? medicine.name
      : medicine.activeIngredient;

  return [
    {
      label: "Bulário Eletrônico da Anvisa",
      url: "https://www.gov.br/anvisa/pt-br/sistemas/bulario-eletronico",
      description:
        "Fonte oficial da Anvisa para consultar a bula do paciente e a bula do profissional.",
      recommendedSearchTerm: query || ""
    },
    {
      label: "Como acessar o Bulário Eletrônico",
      url: "https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/bulas-e-rotulos/como-acessar-o-bulario-eletronico",
      description:
        "Passo a passo oficial da Anvisa para localizar a bula correta no sistema.",
      recommendedSearchTerm: query || ""
    }
  ];
}
