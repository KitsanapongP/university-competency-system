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

export function preferredCooperativeRequirementCopySource(draft, published) {
    const draftHasCopyableItems = draft?.requirements?.some(isCopyableCooperativeRequirement);
    const publishedHasCopyableItems = published?.requirements?.some(isCopyableCooperativeRequirement);

    if (draftHasCopyableItems) return draft;
    if (publishedHasCopyableItems) return published;
    return draft || published || null;
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

export function duplicateCooperativeRequirement(requirements, clientId, createClientId) {
    const index = requirements.findIndex((item) => item.clientId === clientId);
    if (index < 0 || !isCopyableCooperativeRequirement(requirements[index])) {
        return { requirements, duplicateClientId: '' };
    }

    const copy = cloneCooperativeRequirement(requirements[index], createClientId());
    return {
        requirements: [
            ...requirements.slice(0, index + 1),
            copy,
            ...requirements.slice(index + 1),
        ],
        duplicateClientId: copy.clientId,
    };
}

export function cloneSelectedCooperativeRequirements(requirements, selectedClientIds, createClientId) {
    const selected = new Set(selectedClientIds);

    return requirements
        .filter((item) => isCopyableCooperativeRequirement(item) && selected.has(item.clientId))
        .map((item) => cloneCooperativeRequirement(item, createClientId()));
}
