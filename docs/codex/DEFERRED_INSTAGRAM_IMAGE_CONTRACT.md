# Deferred Instagram And Image Contract

Status: deferred from the active Blog SOP analyzer contract on 2026-06-12.

The active SL-A1 analyzer input/output now includes only fields needed for Blog
strategy learning. Instagram and image-style ruleset fields are intentionally
excluded from active prompts, response schemas, seed data, and the marketing
ruleset UI. This note preserves the removed contract pieces for later reuse.

## Deferred Instagram Fields

Previous ruleset sections:

- `write_instagram`
- `image_instagram`

Previous writing fields:

- `instagramPurpose`: Instagram post objective, usually branding or acquisition.
- `instagramWritingStyle`: short caption sentence style.
- `instagramPreferredLength`: caption length and hashtag count policy.
- `instagramHashtags`: local/category/topic hashtag set.
- `instagramEmojiPolicy`: emoji usage policy.

Previous image fields:

- `instagramImageFormat`: aspect ratio and resolution policy.
- `instagramImageStyle`: Instagram-specific visual composition guidance.
- `instagramOverlayPolicy`: card/news overlay and watermark policy.

Previous prompt behavior:

- Fields were input-blocked with `reason: "instagram_not_in_scope"`.
- The prompt constraint said not to invent Instagram inputs.
- Response schemas omitted these fields when blocked and stored placeholder
  `input_blocked` ruleset rows for OpenAI runs.

## Deferred Image Style Fields

Previous ruleset sections:

- `image_common`
- `image_blog`

Previous fields:

- `primaryColors`: main brand/image color guidance.
- `accentColors`: accent color guidance.
- `imageDirection`: visual mood/direction.
- `imageStyle`: common image style.
- `imageAvoidStyle`: styles to avoid.
- `blogImageFormat`: Blog image ratio/count/size guidance.
- `blogImageStyle`: Blog-specific image composition guidance.
- `blogOverlayPolicy`: Blog image text overlay policy.

Previous prompt behavior:

- `AnalysisPromptInput.unavailableData.images` flagged missing image analysis.
- Image fields were input-blocked with `reason: "image_metadata_unavailable"`
  unless collected items had usable `imageAnalysis`, `imageMetadataAnalysis`,
  or `visualAnalysis` metadata.
- Blog generation summarized `imageDirection`, `blogImageFormat`,
  `blogImageStyle`, and `blogOverlayPolicy` when present.

## Reintroduction Checklist

- Add real provider/storage scope for Instagram or image analysis first.
- Restore source-matrix rows only for fields backed by reliable input data.
- Add the deferred reason values back to `BlockedRulesetFieldReason` only if
  fields can be conditionally blocked instead of fully excluded.
- Restore OpenAI response schema keys from `requestedRulesetFieldKeys`; do not
  make deferred fields globally required.
- Rebuild UI tabs only when there is an active generation or editing workflow.
- Keep browser calls routed through `poc-server`; never call Instagram, Naver,
  OpenAI, or image providers directly from static browser pages.
