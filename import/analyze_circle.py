"""
Analisa os 3 CSVs do Circle e gera dois relatorios pra Felipe revisar
antes do import:

1. relatorio_posts.csv — todos os posts que NAO sao do Felipe, com
   space, autor, qtd likes, qtd comments, data e id.

2. relatorio_membros_pendentes.csv — membros do Circle que tem posts
   ou comments mas NAO existem na nossa base (membros.users.email).
   Felipe decide se cria fictício pra cada um ou skipa.

Como rodar:
    cd "d:/Claude Code/areademembros/import"
    python analyze_circle.py
"""

import csv
import os

CIRCLE_DIR = os.path.join(os.path.dirname(__file__), "DADOS DE EXPORTAÇÃO CIRCLE")

FELIPE_EMAIL = "felipe@noplanb.com.br"

# ----- 1. Carrega members do Circle (id -> dict) -----
members_circle = {}
with open(os.path.join(CIRCLE_DIR, "mentoria_20k_members.csv"), encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
        uid = r["User ID"].strip()
        if not uid:
            continue
        members_circle[uid] = {
            "user_id": uid,
            "first_name": r.get("First Name", "").strip(),
            "last_name": r.get("Last Name", "").strip(),
            "email": r.get("Email", "").strip().lower(),
            "avatar_url": r.get("Avatar URL", "").strip(),
            "profile_url": r.get("Profile URL", "").strip(),
            "headline": r.get("Headline", "").strip(),
            "bio": r.get("Bio", "").strip(),
            "join_date": r.get("Join Date", "").strip(),
        }

# Acha ID do Felipe
felipe_id = None
for uid, m in members_circle.items():
    if m["email"] == FELIPE_EMAIL:
        felipe_id = uid
        break

print(f"Felipe Circle ID: {felipe_id}")
print(f"Total members no CSV: {len(members_circle)}")

# ----- 2. Carrega spaces -----
spaces = {}
with open(os.path.join(CIRCLE_DIR, "mentoria_20k_spaces.csv"), encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
        spaces[r["ID"].strip()] = {
            "name": r["Name"],
            "slug": r["Slug"],
        }

# ----- 3. Carrega posts e gera relatorio_posts.csv -----
posts_para_importar = []
authors_with_content = set()  # IDs de members que postaram ou comentaram

with open(os.path.join(CIRCLE_DIR, "mentoria_20k_posts.csv"), encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
        author_id = r.get("Member ID", "").strip()
        if not author_id:
            continue
        authors_with_content.add(author_id)

        # Pula se for Felipe
        if author_id == felipe_id:
            continue

        space_id = r.get("Space ID", "").strip()
        space = spaces.get(space_id, {})
        member = members_circle.get(author_id, {})

        posts_para_importar.append({
            "post_id": r["ID"],
            "space_name": space.get("name", "?"),
            "space_slug": space.get("slug", "?"),
            "criado_em": r.get("Created at", ""),
            "titulo": r.get("Name", ""),
            "autor_nome": r.get("Member Name", ""),
            "autor_email": member.get("email", ""),
            "likes": r.get("Numbers of likes", "0"),
            "comments": r.get("Number of comments", "0"),
        })

# Tambem coleta autores de comments
with open(os.path.join(CIRCLE_DIR, "mentoria_20k_comments.csv"), encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
        author_id = r.get("Member ID", "").strip()
        if author_id:
            authors_with_content.add(author_id)

# Salva relatorio_posts
out_posts = os.path.join(CIRCLE_DIR, "relatorio_posts.csv")
with open(out_posts, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(
        f,
        fieldnames=[
            "post_id",
            "space_name",
            "space_slug",
            "criado_em",
            "titulo",
            "autor_nome",
            "autor_email",
            "likes",
            "comments",
        ],
    )
    writer.writeheader()
    # Ordena por space + data
    posts_para_importar.sort(
        key=lambda p: (p["space_name"], p["criado_em"]),
    )
    writer.writerows(posts_para_importar)

print(f"\n[1] relatorio_posts.csv: {len(posts_para_importar)} posts (excluindo Felipe)")
print(f"    Espaços envolvidos:")
counts = {}
for p in posts_para_importar:
    counts[p["space_name"]] = counts.get(p["space_name"], 0) + 1
for sn, c in sorted(counts.items()):
    print(f"      {sn}: {c} posts")

# ----- 4. Lista de membros nao-cadastrados na nossa base -----
# (vou listar TODOS que tem content; depois cruzamos com Supabase pra
# saber quais NAO existem)
out_authors = os.path.join(CIRCLE_DIR, "relatorio_autores_com_conteudo.csv")
with open(out_authors, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(
        f,
        fieldnames=[
            "circle_user_id",
            "first_name",
            "last_name",
            "email",
            "avatar_url",
            "headline",
            "bio",
            "join_date",
        ],
    )
    writer.writeheader()
    for uid in authors_with_content:
        if uid == felipe_id:
            continue
        m = members_circle.get(uid)
        if not m:
            continue
        writer.writerow({
            "circle_user_id": m["user_id"],
            "first_name": m["first_name"],
            "last_name": m["last_name"],
            "email": m["email"],
            "avatar_url": m["avatar_url"],
            "headline": m["headline"],
            "bio": m["bio"],
            "join_date": m["join_date"],
        })

print(f"\n[2] relatorio_autores_com_conteudo.csv: {len([uid for uid in authors_with_content if uid != felipe_id])} autores (excluindo Felipe)")
print(f"    -> Falta cruzar com Supabase pra identificar os nao-cadastrados")
