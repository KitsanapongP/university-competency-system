function getCourses(category, getCoursesForCategory) {
    if (typeof getCoursesForCategory === 'function') {
        return getCoursesForCategory(category) || [];
    }
    return category?.courses || [];
}

function findCategory(categories, targetId, depth = 0) {
    for (const category of categories || []) {
        if (category.id === targetId) {
            return { category, depth };
        }
        if (category.children?.length) {
            const found = findCategory(category.children, targetId, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

export function getDisplayCourses(categories = [], selectedCategory, showAllCourses = false, getCoursesForCategory) {
    if (showAllCourses) {
        const collectAll = (nodes) => {
            const result = [];
            for (const category of nodes || []) {
                result.push(...getCourses(category, getCoursesForCategory));
                if (category.children?.length) {
                    result.push(...collectAll(category.children));
                }
            }
            return result;
        };
        return collectAll(categories);
    }

    if (!selectedCategory) return [];

    const found = findCategory(categories, selectedCategory.id);
    if (!found) return [];

    const { category, depth } = found;
    if (depth >= 2) {
        return getCourses(category, getCoursesForCategory);
    }

    const result = [...getCourses(category, getCoursesForCategory)];
    for (const child of category.children || []) {
        result.push(...getCourses(child, getCoursesForCategory));
        for (const grandchild of child.children || []) {
            result.push(...getCourses(grandchild, getCoursesForCategory));
        }
    }
    return result;
}
