# Recommendation Service

This is the Python (FastAPI) Microservice for the YouTube-style recommendation engine.

## Overview
(In reserach phase)Based on the Covington et al. 2016 paper ("Deep Neural Networks for YouTube Recommendations").

### Responsibilities
1. **Candidate Generation:** Two-Tower retrieval using Approximate Nearest Neighbors (FAISS).
2. **Deep Ranking Model:** Expected watch time prediction using Weighted Logistic Regression.
3. **Event Consumption:** Listen to RabbitMQ for `video.viewed`, `video.watch_completed`, and `video.liked` events to update the user state.

## Setup
```bash
pip install -r requirements.txt
python main.py
```
