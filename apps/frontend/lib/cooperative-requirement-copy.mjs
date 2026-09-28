const COPYABLE_FIELDS = [
    'criterionType',
    'nameTh',
    'nameEn',
    'minimumValue',
    'minimumGrade',
    'categoryId',
    'courseId',
];

export function isCopyableCooperativeRequirement(requirement) {
    return Boolean(requirement?.criterionType);
}

export function cloneCooperativeRequirement(requirement, clientId) {
    const copy = {
        clientId,
        requirementId: 0,
    };

    for (const field of COPYABLE_FIELDS) {
        copy[field] = requirement[field] ?? '';
    }

    return copy;
}

export function cloneSelectedCooperativeRequirements(requirements, selectedClientIds, createClientId) {
    const selected = new Set(selectedClientIds);

    return requirements
        .filter((item) => isCopyableCooperativeRequirement(item) && selected.has(item.clientId))
        .map((item) => cloneCooperativeRequirement(item, createClientId()));
}
