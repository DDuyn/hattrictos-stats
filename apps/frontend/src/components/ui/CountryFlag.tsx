/**
 * CountryFlag
 *
 * Renders a circular country flag SVG from /public/flags/{code}.svg
 * (circle-flags package, copied to public at setup time).
 * The `code` prop should be an ISO 3166-1 alpha-2 code in lowercase (e.g. "es", "hr").
 * Falls back to a neutral grey circle if the code is null/empty or the SVG fails to load.
 */
export function CountryFlag(props: { code: string | null; size?: number; title?: string }) {
  const size = () => props.size ?? 20;

  if (!props.code) {
    return (
      <span
        class="inline-block rounded-full bg-gray-200 shrink-0"
        style={`width:${size()}px;height:${size()}px;display:inline-block`}
        title={props.title ?? ''}
      />
    );
  }

  return (
    <img
      src={`/flags/${props.code.toLowerCase()}.svg`}
      width={size()}
      height={size()}
      alt={props.title ?? props.code}
      title={props.title ?? props.code}
      class="inline-block rounded-full shrink-0 object-cover"
      style={`width:${size()}px;height:${size()}px`}
      onError={(e) => {
        // If the SVG is missing (unknown country code), show grey circle instead
        const el = e.currentTarget as HTMLImageElement;
        el.style.display = 'none';
        const span = document.createElement('span');
        span.style.cssText = `width:${size()}px;height:${size()}px;display:inline-block;background:#e5e7eb;border-radius:50%`;
        el.parentNode?.insertBefore(span, el);
      }}
    />
  );
}
