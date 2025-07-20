#!/bin/bash
# Script interactif pour gérer les versions de TidyJS

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher le header
show_header() {
  echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║        TidyJS Version Management           ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
  echo ""
}

# Récupérer la version actuelle
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

# Parser la version
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# Si un argument est passé, l'utiliser directement
if [ "$1" == "patch" ] || [ "$1" == "minor" ] || [ "$1" == "major" ]; then
  VERSION_TYPE=$1
else
  # Mode interactif
  show_header
  
  echo -e "${YELLOW}Version actuelle: ${GREEN}$CURRENT_VERSION${NC}"
  echo ""
  echo "Choisissez le type de version à incrémenter :"
  echo ""
  echo -e "${BLUE}1) Patch${NC} ($MAJOR.$MINOR.$PATCH → $MAJOR.$MINOR.$((PATCH + 1)))"
  echo "   └─ Corrections de bugs, petites améliorations"
  echo "   └─ Exemple: Fix import parsing pour les imports mixtes"
  echo ""
  echo -e "${BLUE}2) Minor${NC} ($MAJOR.$MINOR.$PATCH → $MAJOR.$((MINOR + 1)).0)"
  echo "   └─ Nouvelles fonctionnalités, améliorations importantes"
  echo "   └─ Exemple: Ajout du support pour les imports dynamiques"
  echo ""
  echo -e "${BLUE}3) Major${NC} ($MAJOR.$MINOR.$PATCH → $((MAJOR + 1)).0.0)"
  echo "   └─ Changements majeurs, breaking changes"
  echo "   └─ Exemple: Refonte complète de l'API de configuration"
  echo ""
  echo -e "${BLUE}4) Annuler${NC}"
  echo ""
  
  read -p "Votre choix (1-4): " choice
  
  case $choice in
    1) VERSION_TYPE="patch" ;;
    2) VERSION_TYPE="minor" ;;
    3) VERSION_TYPE="major" ;;
    4) 
      echo -e "${YELLOW}Opération annulée${NC}"
      exit 0
      ;;
    *)
      echo -e "${YELLOW}Choix invalide. Opération annulée.${NC}"
      exit 1
      ;;
  esac
fi

# Calculer la nouvelle version
case "$VERSION_TYPE" in
  "major")
    NEW_MAJOR=$((MAJOR + 1))
    NEW_MINOR=0
    NEW_PATCH=0
    ;;
  "minor")
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$((MINOR + 1))
    NEW_PATCH=0
    ;;
  "patch")
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$MINOR
    NEW_PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="$NEW_MAJOR.$NEW_MINOR.$NEW_PATCH"

echo ""
echo -e "${GREEN}► Mise à jour de la version: $CURRENT_VERSION → $NEW_VERSION${NC}"

# Mettre à jour package.json
if command -v jq &> /dev/null; then
  jq --arg version "$NEW_VERSION" '.version = $version' package.json > package.json.tmp
  mv package.json.tmp package.json
else
  sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
  rm -f package.json.bak
fi

echo -e "${GREEN}✓ Version mise à jour dans package.json${NC}"

# Demander si on veut aussi créer le commit et tag
echo ""
read -p "Voulez-vous créer un commit et un tag Git ? (o/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Oo]$ ]]; then
  # Supprimer les anciens .vsix
  echo -e "${BLUE}► Nettoyage des anciens fichiers .vsix...${NC}"
  rm -f *.vsix
  
  # Build le package
  echo -e "${BLUE}► Build du package...${NC}"
  npm run build
  
  # Créer le commit
  git add package.json *.vsix
  git commit -m "chore: bump version to $NEW_VERSION"
  echo -e "${GREEN}✓ Commit créé${NC}"
  
  # Créer le tag
  git tag "v$NEW_VERSION"
  echo -e "${GREEN}✓ Tag v$NEW_VERSION créé${NC}"
  
  # Demander pour push
  echo ""
  read -p "Voulez-vous pousser les changements sur GitHub ? (o/n) " -n 1 -r
  echo ""
  
  if [[ $REPLY =~ ^[Oo]$ ]]; then
    git push origin main
    git push origin "v$NEW_VERSION"
    echo -e "${GREEN}✓ Changements poussés sur GitHub${NC}"
    echo -e "${BLUE}► GitHub Actions va maintenant créer une release automatiquement${NC}"
  else
    echo -e "${YELLOW}► Changements gardés localement${NC}"
    echo "  Pour pousser plus tard: git push origin main && git push origin v$NEW_VERSION"
  fi
else
  echo -e "${GREEN}✓ Version mise à jour (sans commit)${NC}"
  echo "  Pour créer un commit manuellement: git add package.json && git commit -m \"chore: bump version to $NEW_VERSION\""
fi

echo ""
echo -e "${GREEN}✨ Terminé !${NC}"