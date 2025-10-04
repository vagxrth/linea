export interface ColorSwatch {
    name: string
    hexColor: string
    description?: string
}

export interface ColorSection {
    title:
        | 'Primary Colors'
        | 'Secondary & Accent Colors'
        | 'UI Component Colors'
        | 'Utility & Form Colors'
        | 'Status & Feedback Colors'
    swatches: ColorSwatch[]
}

export interface TypographyStyle {
    name: string
    fontFamily: string
    fontSize: string
    fontWeight: string
    lineHeight: string
    letterSpacing?: string
    description?: string
}

export interface TypographySection {
    title: string
    styles: TypographyStyle[]
}

export interface StyleGuide {
    theme: string;
    description: string;
    colorSections: [
        ColorSection,
        ColorSection,
        ColorSection,
        ColorSection,
        ColorSection,
    ]
    typographySections: [
        TypographySection,
        TypographySection,
        TypographySection,
    ]
}