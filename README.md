# 🎓 CampusKart

> **AI-powered campus marketplace for buying, selling, and reclaiming lost items within a college community.**

CampusKart is an AI-powered marketplace designed specifically for college students. It enables students to buy and sell used items while providing an intelligent Lost & Found system. By leveraging AI vision and semantic search, CampusKart simplifies creating product listings and helps users recover lost belongings efficiently.

---

# 📌 Features

## 🛒 Buy & Sell Marketplace

* List used items for sale.
* Browse products posted by other students.
* Search and filter listings.
* Contact sellers directly.
* Secure and user-friendly interface.

## 🤖 AI Sales Notes

Creating product listings is effortless with AI.

### How it Works

1. Seller uploads an image of the product.
2. Claude Vision analyzes:

   * Product category
   * Brand
   * Condition
   * Visible defects
3. AI automatically generates:

   * Product Title
   * Product Description
   * Suggested Price
4. Seller reviews and edits the listing before publishing.

### Benefits

* Saves time
* Better product descriptions
* Consistent listings
* More accurate pricing

---

## 🔍 AI Lost & Found

Students simply describe their lost item in plain English.

Example:

> "I lost a black Wildcraft backpack with a Dell laptop and a blue water bottle."

The system:

* Converts the description into semantic embeddings.
* Compares it with all found-item reports.
* Calculates similarity scores.
* If similarity exceeds **80%**, both parties receive a notification.

This approach is much more accurate than simple keyword matching because it understands the meaning of descriptions.

---

# 🚀 Tech Stack

## Frontend

* React.js
* JavaScript
* HTML5
* CSS3
* Bootstrap / Tailwind CSS

## Backend

* Python
* Flask / FastAPI

## Database

* Firebase Firestore / MongoDB

## AI Services

* Claude Vision API
* Embedding Model
* Semantic Search

## Deployment

* Vercel (Frontend)
* Render / Railway (Backend)

---

# 🏗 Project Architecture

text
                User
                  │
      ┌───────────┴───────────┐
      │                       │
 Buy & Sell             Lost & Found
      │                       │
 Upload Image       Describe Lost Item
      │                       │
Claude Vision API     Embedding Model
      │                       │
Generate Listing      Semantic Search
      │                       │
 Save Listing      Match Found Items
      │                       │
    Database        Notification System

# 🎯 Future Improvements

* User authentication
* College email verification
* Real-time chat
* Wishlist
* Payment integration
* Product recommendations
* Admin dashboard
* Mobile application
* QR-code based item verification
* Multi-college support

---

# 📈 Learning Outcomes

This project demonstrates practical experience with:

* Artificial Intelligence
* Computer Vision
* Semantic Search
* React Development
* Python Backend Development
* REST APIs
* Database Design
* Full Stack Development
* Git & GitHub
* UI/UX Design

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push to your branch.
5. Open a Pull Request.

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Author

**Gulshan Kumar**

B.Tech – Computer Science & Engineering

GitHub: https://github.com/<your-github-username>

If you like this project, please ⭐ the repository and share your feedback.

---

## ⭐ Support

If this project helped you, consider giving it a **Star** on GitHub. Your support motivates future improvements and new open-source projects.
