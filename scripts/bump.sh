#!/bin/bash
# Script interactif pour gérer les versions de TidyJS

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher le header
show_header() {
  printf "${BLUE}╔════════════════════════════════════════════╗${NC}\n"
  printf "${BLUE}║        TidyJS Version Management           ║${NC}\n"
  printf "${BLUE}╚════════════════════════════════════════════╝${NC}\n"
  printf "\n"
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
  
  printf "${YELLOW}Version actuelle: ${GREEN}$CURRENT_VERSION${NC}\n"
  printf "\n"
  printf "Choisissez le type de version à incrémenter :\n"
  printf "\n"
  printf "${BLUE}1) Patch${NC} ($MAJOR.$MINOR.$PATCH → $MAJOR.$MINOR.$((PATCH + 1)))\n"
  printf "   └─ Corrections de bugs, petites améliorations\n"
  printf "   └─ Exemple: Fix import parsing pour les imports mixtes\n"
  printf "\n"
  printf "${BLUE}2) Minor${NC} ($MAJOR.$MINOR.$PATCH → $MAJOR.$((MINOR + 1)).0)\n"
  printf "   └─ Nouvelles fonctionnalités, améliorations importantes\n"
  printf "   └─ Exemple: Ajout du support pour les imports dynamiques\n"
  printf "\n"
  printf "${BLUE}3) Major${NC} ($MAJOR.$MINOR.$PATCH → $((MAJOR + 1)).0.0)\n"
  printf "   └─ Changements majeurs, breaking changes\n"
  printf "   └─ Exemple: Refonte complète de l'API de configuration\n"
  printf "\n"
  printf "${BLUE}4) Annuler${NC}\n"
  printf "\n"
  
  read -p "Votre choix (1-4): " choice
  
  case $choice in
    1) VERSION_TYPE="patch" ;;
    2) VERSION_TYPE="minor" ;;
    3) VERSION_TYPE="major" ;;
    4) 
      printf "${YELLOW}Opération annulée${NC}\n"
      exit 0
      ;;
    *)
      printf "${YELLOW}Choix invalide. Opération annulée.${NC}\n"
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

printf "\n"
printf "${GREEN}► Mise à jour de la version: $CURRENT_VERSION → $NEW_VERSION${NC}\n"

# Mettre à jour package.json
if command -v jq &> /dev/null; then
  jq --arg version "$NEW_VERSION" '.version = $version' package.json > package.json.tmp
  mv package.json.tmp package.json
else
  sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
  rm -f package.json.bak
fi

printf "${GREEN}✓ Version mise à jour dans package.json${NC}\n"

# Demander si on veut aussi créer le commit et tag
printf "\n"
read -p "Voulez-vous créer un commit et un tag Git ? (o/n) " -n 1 -r
printf "\n"

if [[ $REPLY =~ ^[Oo]$ ]]; then
  # Supprimer les anciens .vsix
  printf "${BLUE}► Nettoyage des anciens fichiers .vsix...${NC}\n"
  rm -f *.vsix
  
  # Build le package
  printf "${BLUE}► Build du package...${NC}\n"
  npm run build
  
  # Créer le commit
  git add package.json *.vsix
  git commit -m "chore: bump version to $NEW_VERSION"
  printf "${GREEN}✓ Commit créé${NC}\n"
  
  # Créer le tag
  git tag "v$NEW_VERSION"
  printf "${GREEN}✓ Tag v$NEW_VERSION créé${NC}\n"
  
  # Demander pour push
  printf "\n"
  read -p "Voulez-vous pousser les changements sur GitHub ? (o/n) " -n 1 -r
  printf "\n"
  
  if [[ $REPLY =~ ^[Oo]$ ]]; then
    git push origin main
    git push origin "v$NEW_VERSION"
    printf "${GREEN}✓ Changements poussés sur GitHub${NC}\n"
    printf "${BLUE}► GitHub Actions va maintenant créer une release automatiquement${NC}\n"
  else
    printf "${YELLOW}► Changements gardés localement${NC}\n"
    printf "  Pour pousser plus tard: git push origin main && git push origin v$NEW_VERSION\n"
  fi
else
  printf "${GREEN}✓ Version mise à jour (sans commit)${NC}\n"
  printf "  Pour créer un commit manuellement: git add package.json && git commit -m \"chore: bump version to $NEW_VERSION\"\n"
fi

printf "\n"
printf "${GREEN}✨ Terminé !${NC}\n"