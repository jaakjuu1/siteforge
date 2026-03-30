#!/bin/bash
set -euo pipefail

# SiteForge - New Client Setup Script
# Usage: ./scripts/new-client.sh "Business Name" "city"

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"Business Name\" [city]"
  echo "Example: $0 \"Kampaamo Aurora\" \"Helsinki\""
  exit 1
fi

BUSINESS_NAME="$1"
CITY="${2:-Oulu}"

# Generate slug from business name
SLUG=$(echo "$BUSINESS_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

echo "========================================="
echo "  SiteForge - New Client Setup"
echo "========================================="
echo ""
echo "  Business: $BUSINESS_NAME"
echo "  City:     $CITY"
echo "  Slug:     $SLUG"
echo ""

# Update site.config.ts with new business name and city
CONFIG_FILE="site.config.ts"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: $CONFIG_FILE not found. Run this from the project root."
  exit 1
fi

# Replace business name
sed -i "s/Kampaamo Kirsikka/$BUSINESS_NAME/g" "$CONFIG_FILE"

# Replace city
sed -i "s/Oulu/$CITY/g" "$CONFIG_FILE"

# Replace site URL
sed -i "s|kampaamokirsikka\.fi|${SLUG}.fi|g" "$CONFIG_FILE"

# Replace email
sed -i "s|info@kampaamokirsikka\.fi|info@${SLUG}.fi|g" "$CONFIG_FILE"

# Update robots.txt
sed -i "s|kampaamokirsikka\.fi|${SLUG}.fi|g" "public/robots.txt"

# Update blog posts to reference new name
find src/content/blog -name "*.md" -exec sed -i "s/kampaamoomme/liikkeeseemme/g" {} \;

echo "Done! Next steps:"
echo ""
echo "  1. Edit site.config.ts to customize:"
echo "     - Phone number, email, address"
echo "     - Services and descriptions"
echo "     - Opening hours"
echo "     - Social media links"
echo "     - Theme colors and fonts"
echo ""
echo "  2. Replace placeholder images:"
echo "     - Add your own hero image"
echo "     - Add about section photo"
echo "     - Add blog post images"
echo ""
echo "  3. Update content:"
echo "     - Edit/add blog posts in src/content/blog/"
echo "     - Update testimonials in site.config.ts"
echo ""
echo "  4. Test locally:"
echo "     npm run dev"
echo ""
echo "  5. Build for production:"
echo "     npm run build"
echo ""
