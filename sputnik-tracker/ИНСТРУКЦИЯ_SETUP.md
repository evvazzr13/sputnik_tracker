# Инструкция по запуску «Спутник Трекер»

## Шаг 1 — Создать проект в Firebase

1. Перейдите на https://console.firebase.google.com
2. Нажмите «Добавить проект», введите название (например, «sputnik-tracker»)
3. Analytics можно отключить — нажмите «Создать проект»

## Шаг 2 — Включить Authentication

1. В левом меню выберите **Authentication → Начать**
2. Перейдите на вкладку **Способы входа**
3. Включите **Электронная почта и пароль**

## Шаг 3 — Создать базу данных Firestore

1. В левом меню выберите **Firestore Database → Создать базу данных**
2. Выберите режим **Тест** (production можно настроить позже)
3. Выберите регион (например, `europe-west3` — Франкфурт)

## Шаг 4 — Настроить правила Firestore

В разделе Firestore → Правила вставьте следующее:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Пользователи могут читать свой профиль
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null;
    }
    
    // Команды — все авторизованные могут читать
    match /teams/{teamId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Дети — все авторизованные могут читать и писать
    match /children/{childId} {
      allow read, write: if request.auth != null;
    }
    
    // Посещаемость
    match /attendance/{attId} {
      allow read, write: if request.auth != null;
    }
    
    // Планы дня
    match /dayPlans/{planId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    match /dayPlanDrafts/{planId} {
      allow read, write: if request.auth != null;
    }
    
    match /fixedBlocks/{blockId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

Нажмите **Опубликовать**.

## Шаг 5 — Получить конфиг Firebase

1. В Firebase Console нажмите на шестерёнку → **Настройки проекта**
2. Прокрутите вниз до раздела «Ваши приложения»
3. Нажмите иконку **</>** (Веб)
4. Введите название приложения (любое), нажмите «Зарегистрировать»
5. Скопируйте объект `firebaseConfig`

## Шаг 6 — Вставить конфиг в приложение

Откройте файл `src/firebase/config.js` и замените значения:

```js
const firebaseConfig = {
  apiKey: "ВАШЕ_ЗНАЧЕНИЕ",
  authDomain: "ВАШЕ_ЗНАЧЕНИЕ",
  projectId: "ВАШЕ_ЗНАЧЕНИЕ",
  storageBucket: "ВАШЕ_ЗНАЧЕНИЕ",
  messagingSenderId: "ВАШЕ_ЗНАЧЕНИЕ",
  appId: "ВАШЕ_ЗНАЧЕНИЕ"
}
```

## Шаг 7 — Создать первый аккаунт администратора

После деплоя приложения нужно создать первого администратора вручную через Firebase Console:

1. Перейдите в **Authentication → Пользователи → Добавить пользователя**
2. Введите email и пароль директора (или ответственного за систему)
3. Скопируйте **User UID** нового пользователя
4. Перейдите в **Firestore → Коллекции → + Начать коллекцию** → `users`
5. Добавьте документ с ID = скопированный UID и полями:
   - `email`: (string) — email пользователя
   - `fullName`: (string) — ФИО
   - `role`: (string) — `admin`
   - `adminRole`: (string) — `director`
   - `createdAt`: (timestamp) — текущее время

Все остальные аккаунты администрации создаются уже через интерфейс приложения.

## Шаг 8 — Сборка и деплой

### Локальный запуск (для теста):
```bash
npm install
npm run dev
```

### Деплой на Firebase Hosting:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Выберите проект, укажите папку dist, SPA: yes
npm run build
firebase deploy
```

### Деплой на Vercel (проще):
1. Загрузите папку проекта на GitHub
2. Зайдите на vercel.com, подключите репозиторий
3. Vercel автоматически соберёт и задеплоит

---

## Структура ролей

| Роль | Возможности |
|------|-------------|
| Вожатый | Управление списком своей команды, отметка посещаемости, просмотр плана дня |
| Администрация | Всё вышеперечисленное + управление командами, отчёты, план дня для всех |

Аккаунты администрации: 4 старших вожатых, 4 старших воспитателя, 2 заместителя директора, 1 директор — всего 11 аккаунтов.
