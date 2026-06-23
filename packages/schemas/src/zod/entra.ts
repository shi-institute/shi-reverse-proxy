import z from "zod";

export const entraStaticTenantBranding = z.object({
  BannerLogo: z.union([z.url(), z.literal('')]),
  TileLogo: z.union([z.url(), z.literal('')]),
  Illustration: z.union([z.url(), z.literal('')]),
  BackgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  BoilerPlateText: z.string(),
  UserIdLabel: z.string(),
  KeepMeSignedInDisabled: z.boolean(),
  UseTransparentLightBox: z.boolean(),
  LayoutTemplateConfig: z.looseObject({
    showHeader: z.boolean(),
    headerLogo: z.union([z.url(), z.literal('')]),
    layoutType: z.int(),
    hideCantAccessYourAccount: z.boolean(),
    hideForgotMyPassword: z.boolean(),
    hideResetItNow: z.boolean(),
    hideAccountResetCredentials: z.boolean(),
    showFooter: z.boolean(),
    hideTOU: z.boolean(),
    hidePrivacy: z.boolean(),
  }),
  Favicon: z.union([z.url(), z.literal('')]),
  FooterTOULink: z.url(),
  FooterTOUText: z.string(),
});

export type EntraStaticTenantBranding = z.infer<typeof entraStaticTenantBranding>;
